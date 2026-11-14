export interface GeocodeResult {
  address: string;
  mapsUrl: string;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult> {
  const mapsUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  // 1. Primary Lookup: OpenStreetMap Nominatim with timeout
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

      const street =
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.industrial ||
        "";
      const locality =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.county ||
        addr.state_district ||
        "";
      const state = addr.state || "";
      const postcode = addr.postcode || "";
      const country = addr.country || "India";

      const formattedParts = [
        street,
        locality,
        state && postcode ? `${state} ${postcode}` : state || postcode,
        country,
      ].filter(Boolean);

      if (formattedParts.length > 0) {
        return {
          address: formattedParts.join(", "),
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

  // 2. Secondary Lookup: BigDataCloud Reverse Geocoding API
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

  // 3. Optional Google Maps Geocoding API (if GOOGLE_MAPS_API_KEY is configured)
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
      // Ignore Google API failure
    }
  }

  // Fallback: GPS Coordinates formatted representation
  return {
    address: `Near GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    mapsUrl,
  };
}

