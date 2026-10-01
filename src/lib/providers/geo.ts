import europeAirports from "@/lib/data/europe-airports.json";
import northAmericaAirports from "@/lib/data/north-america-airports.json";
/**
 * Airport catalogue and distance maths.
 *
 * A real deployment would resolve origins against a full IATA dataset (or the
 * provider's own location API). This subset covers every venue's nearest
 * airport plus the major world origins someone would realistically fly from,
 * which is enough to model routes and price them by distance.
 */

export interface Airport {
  iata: string;
  city: string;
  country: string;
  name: string;
  lat: number;
  lon: number;
  /** Rough currency of the origin market, used for display. */
  currency: string;
}

export const AIRPORTS: Airport[] = [
  { iata: "ATL", city: "Atlanta", country: "US", name: "Hartsfield–Jackson", lat: 33.6407, lon: -84.4277, currency: "USD" },
  { iata: "AGS", city: "Augusta", country: "US", name: "Augusta Regional", lat: 33.3699, lon: -81.9645, currency: "USD" },
  { iata: "AUH", city: "Abu Dhabi", country: "AE", name: "Zayed International", lat: 24.4330, lon: 54.6511, currency: "AED" },
  { iata: "AMD", city: "Ahmedabad", country: "IN", name: "Sardar Vallabhbhai Patel", lat: 23.0772, lon: 72.6347, currency: "INR" },
  { iata: "AMS", city: "Amsterdam", country: "NL", name: "Schiphol", lat: 52.3105, lon: 4.7683, currency: "EUR" },
  { iata: "AUS", city: "Austin", country: "US", name: "Austin–Bergstrom", lat: 30.1975, lon: -97.6664, currency: "USD" },
  { iata: "BCN", city: "Barcelona", country: "ES", name: "El Prat", lat: 41.2974, lon: 2.0833, currency: "EUR" },
  { iata: "BHX", city: "Birmingham", country: "GB", name: "Birmingham", lat: 52.4539, lon: -1.7480, currency: "GBP" },
  { iata: "BNA", city: "Nashville", country: "US", name: "Nashville International", lat: 36.1263, lon: -86.6774, currency: "USD" },
  { iata: "BOH", city: "Bournemouth", country: "GB", name: "Bournemouth", lat: 50.7800, lon: -1.8425, currency: "GBP" },
  { iata: "BOM", city: "Mumbai", country: "IN", name: "Chhatrapati Shivaji", lat: 19.0896, lon: 72.8656, currency: "INR" },
  { iata: "BOS", city: "Boston", country: "US", name: "Logan International", lat: 42.3656, lon: -71.0096, currency: "USD" },
  { iata: "BUF", city: "Buffalo", country: "US", name: "Buffalo Niagara", lat: 42.9405, lon: -78.7322, currency: "USD" },
  { iata: "BWI", city: "Baltimore", country: "US", name: "BWI Marshall", lat: 39.1754, lon: -76.6683, currency: "USD" },
  { iata: "CDG", city: "Paris", country: "FR", name: "Charles de Gaulle", lat: 49.0097, lon: 2.5479, currency: "EUR" },
  { iata: "CLE", city: "Cleveland", country: "US", name: "Hopkins International", lat: 41.4117, lon: -81.8498, currency: "USD" },
  { iata: "CLT", city: "Charlotte", country: "US", name: "Charlotte Douglas", lat: 35.2144, lon: -80.9473, currency: "USD" },
  { iata: "CVG", city: "Cincinnati", country: "US", name: "Cincinnati/Northern Kentucky", lat: 39.0489, lon: -84.6678, currency: "USD" },
  { iata: "DCA", city: "Washington", country: "US", name: "Reagan National", lat: 38.8512, lon: -77.0402, currency: "USD" },
  { iata: "DEL", city: "Delhi", country: "IN", name: "Indira Gandhi", lat: 28.5562, lon: 77.1000, currency: "INR" },
  { iata: "DEN", city: "Denver", country: "US", name: "Denver International", lat: 39.8561, lon: -104.6737, currency: "USD" },
  { iata: "DFW", city: "Dallas", country: "US", name: "Dallas/Fort Worth", lat: 32.8998, lon: -97.0403, currency: "USD" },
  { iata: "DTW", city: "Detroit", country: "US", name: "Detroit Metropolitan", lat: 42.2162, lon: -83.3554, currency: "USD" },
  { iata: "DOH", city: "Doha", country: "QA", name: "Hamad International", lat: 25.2731, lon: 51.6081, currency: "QAR" },
  { iata: "DXB", city: "Dubai", country: "AE", name: "Dubai International", lat: 25.2532, lon: 55.3657, currency: "AED" },
  { iata: "EDI", city: "Edinburgh", country: "GB", name: "Edinburgh", lat: 55.9508, lon: -3.3615, currency: "GBP" },
  { iata: "EMA", city: "Nottingham", country: "GB", name: "East Midlands", lat: 52.8311, lon: -1.3281, currency: "GBP" },
  { iata: "EWR", city: "Newark", country: "US", name: "Newark Liberty", lat: 40.6895, lon: -74.1745, currency: "USD" },
  { iata: "FCO", city: "Rome", country: "IT", name: "Fiumicino", lat: 41.8003, lon: 12.2389, currency: "EUR" },
  { iata: "FRA", city: "Frankfurt", country: "DE", name: "Frankfurt am Main", lat: 50.0379, lon: 8.5622, currency: "EUR" },
  { iata: "GIG", city: "Rio de Janeiro", country: "BR", name: "Galeão", lat: -22.8100, lon: -43.2506, currency: "BRL" },
  { iata: "GRB", city: "Green Bay", country: "US", name: "Austin Straubel", lat: 44.4851, lon: -88.1296, currency: "USD" },
  { iata: "GRU", city: "São Paulo", country: "BR", name: "Guarulhos", lat: -23.4356, lon: -46.4731, currency: "BRL" },
  { iata: "GYD", city: "Baku", country: "AZ", name: "Heydar Aliyev", lat: 40.4675, lon: 50.0467, currency: "AZN" },
  { iata: "HND", city: "Tokyo", country: "JP", name: "Haneda", lat: 35.5494, lon: 139.7798, currency: "JPY" },
  { iata: "IAH", city: "Houston", country: "US", name: "George Bush", lat: 29.9902, lon: -95.3368, currency: "USD" },
  { iata: "IND", city: "Indianapolis", country: "US", name: "Indianapolis International", lat: 39.7169, lon: -86.2956, currency: "USD" },
  { iata: "IST", city: "Istanbul", country: "TR", name: "Istanbul Airport", lat: 41.2753, lon: 28.7519, currency: "TRY" },
  { iata: "JAX", city: "Jacksonville", country: "US", name: "Jacksonville International", lat: 30.4941, lon: -81.6879, currency: "USD" },
  { iata: "JFK", city: "New York", country: "US", name: "John F. Kennedy", lat: 40.6413, lon: -73.7781, currency: "USD" },
  { iata: "JNB", city: "Johannesburg", country: "ZA", name: "O. R. Tambo", lat: -26.1367, lon: 28.2411, currency: "ZAR" },
  { iata: "KUL", city: "Kuala Lumpur", country: "MY", name: "Kuala Lumpur International", lat: 2.7456, lon: 101.7099, currency: "MYR" },
  { iata: "LAS", city: "Las Vegas", country: "US", name: "Harry Reid", lat: 36.0840, lon: -115.1537, currency: "USD" },
  { iata: "LAX", city: "Los Angeles", country: "US", name: "Los Angeles International", lat: 33.9416, lon: -118.4085, currency: "USD" },
  { iata: "LBA", city: "Leeds", country: "GB", name: "Leeds Bradford", lat: 53.8659, lon: -1.6606, currency: "GBP" },
  { iata: "LCY", city: "London", country: "GB", name: "London City", lat: 51.5053, lon: 0.0553, currency: "GBP" },
  { iata: "LGW", city: "London", country: "GB", name: "Gatwick", lat: 51.1537, lon: -0.1821, currency: "GBP" },
  { iata: "LHR", city: "London", country: "GB", name: "Heathrow", lat: 51.4700, lon: -0.4543, currency: "GBP" },
  { iata: "LPL", city: "Liverpool", country: "GB", name: "John Lennon", lat: 53.3336, lon: -2.8497, currency: "GBP" },
  { iata: "MAD", city: "Madrid", country: "ES", name: "Barajas", lat: 40.4983, lon: -3.5676, currency: "EUR" },
  { iata: "MAN", city: "Manchester", country: "GB", name: "Manchester", lat: 53.3537, lon: -2.2750, currency: "GBP" },
  { iata: "MCI", city: "Kansas City", country: "US", name: "Kansas City International", lat: 39.2976, lon: -94.7139, currency: "USD" },
  { iata: "MCO", city: "Orlando", country: "US", name: "Orlando International", lat: 28.4312, lon: -81.3081, currency: "USD" },
  { iata: "MEL", city: "Melbourne", country: "AU", name: "Tullamarine", lat: -37.6690, lon: 144.8410, currency: "AUD" },
  { iata: "MEM", city: "Memphis", country: "US", name: "Memphis International", lat: 35.0424, lon: -89.9767, currency: "USD" },
  { iata: "MEX", city: "Mexico City", country: "MX", name: "Benito Juárez", lat: 19.4361, lon: -99.0719, currency: "MXN" },
  { iata: "MIA", city: "Miami", country: "US", name: "Miami International", lat: 25.7959, lon: -80.2870, currency: "USD" },
  { iata: "MKE", city: "Milwaukee", country: "US", name: "Mitchell International", lat: 42.9472, lon: -87.8966, currency: "USD" },
  { iata: "MSP", city: "Minneapolis", country: "US", name: "Minneapolis–Saint Paul", lat: 44.8848, lon: -93.2223, currency: "USD" },
  { iata: "MSY", city: "New Orleans", country: "US", name: "Louis Armstrong", lat: 29.9934, lon: -90.2581, currency: "USD" },
  { iata: "MUC", city: "Munich", country: "DE", name: "Franz Josef Strauss", lat: 48.3538, lon: 11.7861, currency: "EUR" },
  { iata: "MXP", city: "Milan", country: "IT", name: "Malpensa", lat: 45.6301, lon: 8.7255, currency: "EUR" },
  { iata: "NCE", city: "Nice", country: "FR", name: "Côte d'Azur", lat: 43.6584, lon: 7.2159, currency: "EUR" },
  { iata: "NCL", city: "Newcastle", country: "GB", name: "Newcastle", lat: 55.0375, lon: -1.6917, currency: "GBP" },
  { iata: "NGO", city: "Nagoya", country: "JP", name: "Chubu Centrair", lat: 34.8584, lon: 136.8054, currency: "JPY" },
  { iata: "OKC", city: "Oklahoma City", country: "US", name: "Will Rogers", lat: 35.3931, lon: -97.6007, currency: "USD" },
  { iata: "ORD", city: "Chicago", country: "US", name: "O'Hare", lat: 41.9742, lon: -87.9073, currency: "USD" },
  { iata: "PDX", city: "Portland", country: "US", name: "Portland International", lat: 45.5898, lon: -122.5951, currency: "USD" },
  { iata: "PHL", city: "Philadelphia", country: "US", name: "Philadelphia International", lat: 39.8744, lon: -75.2424, currency: "USD" },
  { iata: "PHX", city: "Phoenix", country: "US", name: "Sky Harbor", lat: 33.4342, lon: -112.0116, currency: "USD" },
  { iata: "PIT", city: "Pittsburgh", country: "US", name: "Pittsburgh International", lat: 40.4915, lon: -80.2329, currency: "USD" },
  { iata: "SAT", city: "San Antonio", country: "US", name: "San Antonio International", lat: 29.5337, lon: -98.4698, currency: "USD" },
  { iata: "SEA", city: "Seattle", country: "US", name: "Seattle–Tacoma", lat: 47.4502, lon: -122.3088, currency: "USD" },
  { iata: "SFO", city: "San Francisco", country: "US", name: "San Francisco International", lat: 37.6213, lon: -122.3790, currency: "USD" },
  { iata: "SIN", city: "Singapore", country: "SG", name: "Changi", lat: 1.3644, lon: 103.9915, currency: "SGD" },
  { iata: "SJC", city: "San Jose", country: "US", name: "Norman Y. Mineta", lat: 37.3639, lon: -121.9289, currency: "USD" },
  { iata: "SLC", city: "Salt Lake City", country: "US", name: "Salt Lake City International", lat: 40.7899, lon: -111.9791, currency: "USD" },
  { iata: "SMF", city: "Sacramento", country: "US", name: "Sacramento International", lat: 38.6954, lon: -121.5908, currency: "USD" },
  { iata: "STN", city: "London", country: "GB", name: "Stansted", lat: 51.8860, lon: 0.2389, currency: "GBP" },
  { iata: "SYD", city: "Sydney", country: "AU", name: "Kingsford Smith", lat: -33.9399, lon: 151.1753, currency: "AUD" },
  { iata: "TPA", city: "Tampa", country: "US", name: "Tampa International", lat: 27.9755, lon: -82.5332, currency: "USD" },
  { iata: "YUL", city: "Montreal", country: "CA", name: "Pierre Elliott Trudeau", lat: 45.4706, lon: -73.7408, currency: "CAD" },
  { iata: "YYZ", city: "Toronto", country: "CA", name: "Pearson International", lat: 43.6777, lon: -79.6248, currency: "CAD" },
];

/**
 * Every airport we can fly *to*: the catalogue above plus Europe's large
 * airports and the North American airports nearest NFL, NBA and MLS venues
 * (both from OurAirports, public domain), so every stadium has a nearest
 * airport. Origins still resolve against the catalogue above only.
 */
export const AIRPORTS_BY_IATA = new Map<string, Airport>([
  ...(europeAirports as Omit<Airport, "currency">[]).map(
    (a) => [a.iata, { ...a, currency: "EUR" }] as [string, Airport],
  ),
  ...(northAmericaAirports as Omit<Airport, "currency">[]).map(
    (a) => [a.iata, { ...a, currency: a.country === "CA" ? "CAD" : "USD" }] as [string, Airport],
  ),
  ...AIRPORTS.map((a) => [a.iata, a] as [string, Airport]),
]);

/**
 * Cities with several airports. The cheapest flight to "London" often isn't
 * from Heathrow, so searches use the IATA metro code (LON = every London
 * airport) — checked against Expedia, which shows it as "LON-All Airports".
 * `main` is the airport used for distance maths and for display.
 */
const METROS: Record<string, { code: string; main: string }> = {
  London: { code: "LON", main: "LHR" },
  "New York": { code: "NYC", main: "JFK" },
  Newark: { code: "NYC", main: "JFK" },
  Chicago: { code: "CHI", main: "ORD" },
  Washington: { code: "WAS", main: "DCA" },
  Paris: { code: "PAR", main: "CDG" },
  Milan: { code: "MIL", main: "MXP" },
  Rome: { code: "ROM", main: "FCO" },
  Tokyo: { code: "TYO", main: "HND" },
  "São Paulo": { code: "SAO", main: "GRU" },
  "Rio de Janeiro": { code: "RIO", main: "GIG" },
  Montreal: { code: "YMQ", main: "YUL" },
  Toronto: { code: "YTO", main: "YYZ" },
};

/** The code to search flights with: every airport in the city where there's a choice. */
export function flightSearchCode(airport: Airport): string {
  return METROS[airport.city]?.code ?? airport.iata;
}

export function hasSeveralAirports(airport: Airport): boolean {
  return airport.city in METROS;
}

/**
 * Resolves whatever the user typed into an airport: an IATA code, a city name,
 * or a partial match. Returns null rather than guessing wildly, so the UI can
 * ask again instead of quoting a flight from the wrong continent.
 */
export function resolveOrigin(input: string): Airport | null {
  const q = input.trim().toLowerCase();
  if (!q) return null;

  const byCode = AIRPORTS_BY_IATA.get(q.toUpperCase());
  if (byCode) return byCode;

  // A city's main airport, not whichever one sorts first — "London" used to
  // resolve to London City, a small airport most flights don't use.
  const metro = Object.entries(METROS).find(([city]) => city.toLowerCase() === q);
  if (metro) return AIRPORTS_BY_IATA.get(metro[1].main) ?? null;

  const exactCity = AIRPORTS.find((a) => a.city.toLowerCase() === q);
  if (exactCity) return exactCity;

  const partial = AIRPORTS.find(
    (a) =>
      a.city.toLowerCase().startsWith(q) || a.name.toLowerCase().includes(q),
  );
  return partial ?? null;
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Major international hubs, besides the multi-airport cities in METROS. */
const HUB_IATA = new Set([
  "ATL", "DFW", "DEN", "LAX", "SFO", "SEA", "MIA", "BOS", "IAH", "PHX", "MSP", "DTW", "PHL", "CLT", "LAS", "MCO",
  "YVR", "YYC", "FRA", "MUC", "BER", "AMS", "MAD", "BCN", "ZRH", "VIE", "CPH", "DUB", "IST", "LIS", "BRU", "MAN",
]);
const isHub = (a: Airport) => a.city in METROS || HUB_IATA.has(a.iata);

/**
 * Other airports within `km` of this one (same country, different city
 * code): big multi-airport cities first, then nearest. Used when the venue's
 * or traveller's own airport has no fares.
 */
export function nearbyAirports(airport: Airport, km = 160): { code: string; name: string; miles: number }[] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dist = (a: Airport, b: Airport) => {
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  };
  const own = flightSearchCode(airport);
  const seen = new Set<string>([own]);
  return [...AIRPORTS_BY_IATA.values()]
    .filter((a) => a.country === airport.country)
    .map((a) => ({ a, d: dist(airport, a) }))
    .filter(({ d }) => d > 0 && d <= km)
    // Big hubs first (far more fares on record), then nearest.
    .sort((x, y) => Number(isHub(y.a)) - Number(isHub(x.a)) || x.d - y.d)
    .flatMap(({ a, d }) => {
      const code = flightSearchCode(a);
      if (seen.has(code)) return [];
      seen.add(code);
      return [{ code, name: a.city, miles: Math.round(d / 1.609) }];
    })
    .slice(0, 3);
}
