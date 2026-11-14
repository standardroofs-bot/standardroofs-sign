import { prisma } from "@/lib/prisma";

export interface GeocodeResult {
  address: string;
  mapsUrl: string;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult> {
  const mapsUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  // 1. Exact Landmark Match for Standard Roofs HQ & Factory Premises
  // (11.338365, 77.659146 — Near Sreeamman Weighbridge, SH 173, Vellakkal Medu, Nasiyanur)
  const distToHQMeters =
    Math.hypot(
      lat - 11.338365,
      (lng - 77.659146) * Math.cos((lat * Math.PI) / 180)
    ) * 111000;

  if (distToHQMeters <= 750) {
    return {
      address:
        "144, Vellakkal Medu, Near Sreeamman Weighbridge, SH 173, Nasiyanur, Erode, Tamil Nadu 638107, India",
      mapsUrl,
    };
  }

  // 2. Google Maps Geocoding API (Doorstep Indian Precision if GOOGLE_MAPS_API_KEY is configured in env or DB)
  let gApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!gApiKey) {
    try {
      const settings = await prisma.companySettings.findUnique({
        where: { id: "default" },
        select: { googleMapsApiKey: true },
      });
      if (settings?.googleMapsApiKey) {
        gApiKey = settings.googleMapsApiKey.trim();
      }
    } catch (_) {}
  }

  if (gApiKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${gApiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results[0]?.formatted_address) {
          return {
            address: data.results[0].formatted_address,
            mapsUrl,
          };
        }
      }
    } catch (gErr) {
      console.warn("Google Maps Geocoding API error:", gErr);
    }
  }

  // 3. OpenStreetMap Nominatim with dual-zoom validation & BigDataCloud Google Plus Code integration
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // Fetch street-level details (zoom 18) and town-level confirmation (zoom 12) in parallel
    const [res18, res12, bdcRes] = await Promise.allSettled([
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "StandardESign/1.0 (info@standardroofs.in; https://standardroofs.in)",
            Accept: "application/json",
          },
        }
      ),
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lng)}&zoom=12&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "StandardESign/1.0 (info@standardroofs.in; https://standardroofs.in)",
            Accept: "application/json",
          },
        }
      ),
      fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
          lat
        )}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`,
        { signal: controller.signal }
      ),
    ]);

    clearTimeout(timeoutId);

    let addr18: Record<string, string> = {};
    if (res18.status === "fulfilled" && res18.value.ok) {
      const d = await res18.value.json();
      addr18 = d.address || {};
    }

    let trueTown = "";
    let truePostcode = "";
    if (res12.status === "fulfilled" && res12.value.ok) {
      const d12 = await res12.value.json();
      const a12 = d12.address || {};
      trueTown = a12.town || a12.village || a12.city || "";
      truePostcode = a12.postcode || "";
    }

    let plusCode = "";
    if (bdcRes.status === "fulfilled" && bdcRes.value.ok) {
      const bdcData = await bdcRes.value.json();
      if (bdcData.plusCode) {
        // e.g. "7J3V8MQ5+9M" -> local "8MQ5+9M"
        const clean = String(bdcData.plusCode).replace(/^[A-Z0-9]{4}/, "");
        plusCode = clean.trim();
      }
    }

    // Specific Landmark / Building / Shop / POI
    const place =
      addr18.amenity ||
      addr18.building ||
      addr18.shop ||
      addr18.office ||
      addr18.leisure ||
      addr18.tourism ||
      addr18.commercial ||
      "";

    const houseNumber = addr18.house_number || addr18.house_name || "";
    const road = addr18.road || addr18.street || addr18.footway || "";
    const streetLine = [houseNumber, place, road].filter(Boolean).join(" ");

    // Indian Local Governance Hierarchy:
    // If town/village is distinct (e.g. "Nasiyanur"), prioritize it and eliminate erroneous overlapping suburb boundaries (like "Villarasampatti")
    const townOrVillage = trueTown || addr18.town || addr18.village || addr18.city || "";

    let subArea = "";
    if (addr18.suburb && addr18.suburb !== townOrVillage) {
      // In Indian OSM data, large city suburb boundaries often falsely cover rural taluks/towns
      // Only include suburb if there is NO specific town detected or if suburb is a direct local ward
      if (!addr18.town && !trueTown) {
        subArea = addr18.suburb;
      }
    } else if (addr18.neighbourhood && addr18.neighbourhood !== townOrVillage) {
      subArea = addr18.neighbourhood;
    }

    const district = addr18.county || addr18.state_district || "Erode";
    const state = addr18.state || "Tamil Nadu";
    const postcode = truePostcode || addr18.postcode || "";
    const country = addr18.country || "India";

    const parts = [
      streetLine,
      subArea,
      townOrVillage,
      district !== townOrVillage ? district : "",
      state && postcode ? `${state} ${postcode}` : state || postcode,
      country,
    ].filter(Boolean);

    if (parts.length > 0) {
      let finalAddr = parts.join(", ");
      if (plusCode && !finalAddr.includes(plusCode)) {
        finalAddr += ` (${plusCode})`;
      }
      return {
        address: finalAddr,
        mapsUrl,
      };
    }
  } catch (err) {
    console.warn("Enhanced reverse geocode error:", err);
  }

  // Fallback: GPS Coordinates formatted representation
  return {
    address: `Near GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    mapsUrl,
  };
}

