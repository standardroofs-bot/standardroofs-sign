export interface GeocodeResult {
  address: string;
  mapsUrl: string;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult> {
  const mapsUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  // 1. Google Maps Geocoding API (Doorstep Indian Precision if GOOGLE_MAPS_API_KEY is configured)
  const gApiKey = process.env.GOOGLE_MAPS_API_KEY;
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
    } catch {
      // Ignore Google API failure, fall through to Nominatim
    }
  }

  // 2. OpenStreetMap Nominatim with Building-Level Zoom (18)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    const res = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "StandardESign/1.0 (info@standardroofs.in; https://standardroofs.in)",
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      // Building / place / business / landmark
      const place =
        addr.amenity ||
        addr.building ||
        addr.shop ||
        addr.office ||
        addr.leisure ||
        addr.tourism ||
        addr.commercial ||
        "";

      // House / Door / Unit number
      const houseNumber = addr.house_number || addr.house_name || "";

      // Road / Street
      const road = addr.road || addr.street || addr.footway || "";

      // Assemble door/building + road
      const streetLine = [houseNumber, place, road].filter(Boolean).join(" ");

      // Neighborhood / locality / suburb / industrial area
      const neighbourhood =
        addr.neighbourhood ||
        addr.suburb ||
        addr.residential ||
        addr.industrial ||
        addr.quarter ||
        "";

      // City / Town / Village / Taluk
      const locality =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.city_district ||
        "";

      // District / County
      const district = addr.county || addr.state_district || "";

      // State and Postcode
      const state = addr.state || "";
      const postcode = addr.postcode || "";
      const country = addr.country || "India";

      // Build hierarchical specific address
      const parts = [
        streetLine,
        neighbourhood,
        locality && locality !== neighbourhood ? locality : "",
        district && district !== locality && district !== neighbourhood ? district : "",
        state && postcode ? `${state} ${postcode}` : state || postcode,
        country,
      ].filter(Boolean);

      if (parts.length > 0) {
        return {
          address: parts.join(", "),
          mapsUrl,
        };
      }

      if (data.display_name) {
        return {
          address: String(data.display_name).slice(0, 140),
          mapsUrl,
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim reverse geocode error or timeout:", err);
  }

  // 3. Secondary Lookup: BigDataCloud Reverse Geocoding API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;

    const res = await fetch(bdcUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.city || "";
      const state = data.principalSubdivision || "";
      const postcode = data.postcode || "";
      const country = data.countryName || "India";

      const parts = [
        locality,
        state && postcode ? `${state} ${postcode}` : state || postcode,
        country,
      ].filter(Boolean);

      if (parts.length > 0) {
        return {
          address: parts.join(", "),
          mapsUrl,
        };
      }
    }
  } catch (err) {
    console.warn("BigDataCloud reverse geocode error:", err);
  }

  // Fallback: GPS Coordinates formatted representation
  return {
    address: `Near GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    mapsUrl,
  };
}

