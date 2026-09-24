import type { SportId, Team, Venue } from "@/lib/domain/types";
import { logoFor } from "@/lib/data/logos";

/**
 * Team and venue seed data for the three leagues with full depth.
 *
 * Teams and venues are authored together in one compact row because they're
 * one-to-one for club sport, and keeping them adjacent is what stops the
 * coordinates from drifting away from the club that plays there. `expand()`
 * splits them into the two normalised tables the rest of the app reads —
 * which is also the shape the eventual `teams` / `venues` SQL tables take.
 *
 * Coordinates are the stadium itself, not the city centre: walking distance to
 * the gate is the number that decides whether a hotel is worth booking.
 */
type Row = [
  id: string,
  shortName: string,
  fullName: string,
  city: string,
  country: string,
  venueName: string,
  lat: number,
  lon: number,
  capacity: number,
  airport: string,
  opened: number,
  founded: number,
  primary: string,
  secondary: string,
  titles: number,
];

/**
 * Crest codes in order of preference. The first that isn't already taken in the
 * league wins, so the common case stays short and only genuine collisions get
 * longer. Nickname-derived fallbacks are preferred over city-derived ones —
 * "LRA" reads as the Rams; "LOS" reads as nothing.
 */
function candidateCodes(name: string): string[] {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => w.length > 0 && !/^(FC|AFC|CF|SC|AC)$/i.test(w));

  const source = words.length > 0 ? words : [name.replace(/[^A-Za-z0-9]/g, "")];
  const first = source[0];
  const last = source[source.length - 1];

  const codes =
    source.length === 1
      ? [first.slice(0, 2), first.slice(0, 3)]
      : [
          first[0] + last[0],
          first[0] + last.slice(0, 2),
          first.slice(0, 3),
          first.slice(0, 2) + last[0],
        ];

  return codes.map((c) => c.toUpperCase());
}

function assignAbbreviations(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    for (const code of candidateCodes(name)) {
      if (!used.has(code)) {
        used.add(code);
        return code;
      }
    }
    // Every candidate taken — suffix until unique rather than ever duplicating.
    const base = candidateCodes(name)[0];
    let n = 2;
    while (used.has(`${base}${n}`)) n++;
    used.add(`${base}${n}`);
    return `${base}${n}`;
  });
}

function expand(
  rows: Row[],
  leagueId: string,
  sportId: SportId,
): { teams: Team[]; venues: Venue[] } {
  const teams: Team[] = [];
  const venues: Venue[] = [];
  const abbreviations = assignAbbreviations(rows.map((r) => r[2]));

  for (const [index, r] of rows.entries()) {
    const venueId = `${r[0]}-venue`;
    venues.push({
      id: venueId,
      name: r[5],
      city: r[3],
      country: r[4],
      lat: r[6],
      lon: r[7],
      capacity: r[8],
      nearestAirport: r[9],
      opened: r[10],
    });
    teams.push({
      id: r[0],
      leagueId,
      sportId,
      name: r[2],
      shortName: r[1],
      city: r[3],
      country: r[4],
      venueId,
      founded: r[11],
      primaryColor: r[12],
      secondaryColor: r[13],
      titles: r[14],
      abbreviation: abbreviations[index],
      // Undefined until a licensed crest is configured — see data/logos.ts.
      logoUrl: logoFor(r[0]),
    });
  }
  return { teams, venues };
}

// ---------------------------------------------------------------------------
// NBA
// ---------------------------------------------------------------------------
const NBA_ROWS: Row[] = [
  ["hawks","Hawks","Atlanta Hawks","Atlanta","US","State Farm Arena",33.7573,-84.3963,16600,"ATL",1999,1946,"#E03A3E","#C1D32F",1],
  ["celtics","Celtics","Boston Celtics","Boston","US","TD Garden",42.3662,-71.0621,19156,"BOS",1995,1946,"#007A33","#BA9653",18],
  ["nets","Nets","Brooklyn Nets","Brooklyn","US","Barclays Center",40.6826,-73.9754,17732,"JFK",2012,1967,"#000000","#FFFFFF",0],
  ["hornets","Hornets","Charlotte Hornets","Charlotte","US","Spectrum Center",35.2251,-80.8392,19077,"CLT",2005,1988,"#1D1160","#00788C",0],
  ["bulls","Bulls","Chicago Bulls","Chicago","US","United Center",41.8807,-87.6742,20917,"ORD",1994,1966,"#CE1141","#000000",6],
  ["cavaliers","Cavaliers","Cleveland Cavaliers","Cleveland","US","Rocket Arena",41.4965,-81.6882,19432,"CLE",1994,1970,"#860038","#FDBB30",1],
  ["mavericks","Mavericks","Dallas Mavericks","Dallas","US","American Airlines Center",32.7905,-96.8104,19200,"DFW",2001,1980,"#00538C","#002B5E",1],
  ["nuggets","Nuggets","Denver Nuggets","Denver","US","Ball Arena",39.7487,-105.0077,19520,"DEN",1999,1967,"#0E2240","#FEC524",1],
  ["pistons","Pistons","Detroit Pistons","Detroit","US","Little Caesars Arena",42.3411,-83.0553,20332,"DTW",2017,1941,"#C8102E","#1D42BA",3],
  ["warriors","Warriors","Golden State Warriors","San Francisco","US","Chase Center",37.7680,-122.3878,18064,"SFO",2019,1946,"#1D428A","#FFC72C",7],
  ["rockets","Rockets","Houston Rockets","Houston","US","Toyota Center",29.7508,-95.3621,18055,"IAH",2003,1967,"#CE1141","#000000",2],
  ["pacers","Pacers","Indiana Pacers","Indianapolis","US","Gainbridge Fieldhouse",39.7640,-86.1555,17923,"IND",1999,1967,"#002D62","#FDBB30",0],
  ["clippers","Clippers","LA Clippers","Inglewood","US","Intuit Dome",33.9450,-118.3417,18000,"LAX",2024,1970,"#C8102E","#1D428A",0],
  ["lakers","Lakers","Los Angeles Lakers","Los Angeles","US","Crypto.com Arena",34.0430,-118.2673,19068,"LAX",1999,1947,"#552583","#FDB927",17],
  ["grizzlies","Grizzlies","Memphis Grizzlies","Memphis","US","FedExForum",35.1382,-90.0505,17794,"MEM",2004,1995,"#5D76A9","#12173F",0],
  ["heat","Heat","Miami Heat","Miami","US","Kaseya Center",25.7814,-80.1870,19600,"MIA",1999,1988,"#98002E","#F9A01B",3],
  ["bucks","Bucks","Milwaukee Bucks","Milwaukee","US","Fiserv Forum",43.0451,-87.9172,17341,"MKE",2018,1968,"#00471B","#EEE1C6",2],
  ["timberwolves","Timberwolves","Minnesota Timberwolves","Minneapolis","US","Target Center",44.9795,-93.2761,18798,"MSP",1990,1989,"#0C2340","#236192",0],
  ["pelicans","Pelicans","New Orleans Pelicans","New Orleans","US","Smoothie King Center",29.9490,-90.0821,16867,"MSY",1999,2002,"#0C2340","#C8102E",0],
  ["knicks","Knicks","New York Knicks","New York","US","Madison Square Garden",40.7505,-73.9934,19812,"JFK",1968,1946,"#006BB6","#F58426",2],
  ["thunder","Thunder","Oklahoma City Thunder","Oklahoma City","US","Paycom Center",35.4634,-97.5151,18203,"OKC",2002,1967,"#007AC1","#EF3B24",2],
  ["magic","Magic","Orlando Magic","Orlando","US","Kia Center",28.5392,-81.3839,18846,"MCO",2010,1989,"#0077C0","#C4CED4",0],
  ["sixers","76ers","Philadelphia 76ers","Philadelphia","US","Wells Fargo Center",39.9012,-75.1720,20478,"PHL",1996,1949,"#006BB6","#ED174C",3],
  ["suns","Suns","Phoenix Suns","Phoenix","US","Footprint Center",33.4457,-112.0712,18055,"PHX",1992,1968,"#1D1160","#E56020",0],
  ["blazers","Trail Blazers","Portland Trail Blazers","Portland","US","Moda Center",45.5316,-122.6668,19393,"PDX",1995,1970,"#E03A3E","#000000",1],
  ["kings","Kings","Sacramento Kings","Sacramento","US","Golden 1 Center",38.5802,-121.4997,17608,"SMF",2016,1945,"#5A2D81","#63727A",1],
  ["spurs","Spurs","San Antonio Spurs","San Antonio","US","Frost Bank Center",29.4270,-98.4375,18418,"SAT",2002,1967,"#C4CED4","#000000",5],
  ["raptors","Raptors","Toronto Raptors","Toronto","CA","Scotiabank Arena",43.6435,-79.3791,19800,"YYZ",1999,1995,"#CE1141","#000000",1],
  ["jazz","Jazz","Utah Jazz","Salt Lake City","US","Delta Center",40.7683,-111.9011,18306,"SLC",1991,1974,"#002B5C","#F9A01B",0],
  ["wizards","Wizards","Washington Wizards","Washington","US","Capital One Arena",38.8981,-77.0209,20356,"DCA",1997,1961,"#002B5C","#E31837",1],
];

// ---------------------------------------------------------------------------
// Premier League
// ---------------------------------------------------------------------------
const EPL_ROWS: Row[] = [
  ["arsenal","Arsenal","Arsenal FC","London","GB","Emirates Stadium",51.5549,-0.1084,60704,"LHR",2006,1886,"#EF0107","#FFFFFF",3],
  ["aston-villa","Aston Villa","Aston Villa FC","Birmingham","GB","Villa Park",52.5092,-1.8848,42657,"BHX",1897,1874,"#95BFE5","#670E36",1],
  ["bournemouth","Bournemouth","AFC Bournemouth","Bournemouth","GB","Vitality Stadium",50.7348,-1.8383,11307,"BOH",1910,1899,"#DA291C","#000000",0],
  ["brentford","Brentford","Brentford FC","London","GB","Gtech Community Stadium",51.4907,-0.2887,17250,"LHR",2020,1889,"#E30613","#FBB800",0],
  ["brighton","Brighton","Brighton & Hove Albion","Brighton","GB","Amex Stadium",50.8616,-0.0837,31800,"LGW",2011,1901,"#0057B8","#FFCD00",0],
  ["burnley","Burnley","Burnley FC","Burnley","GB","Turf Moor",53.7890,-2.2303,21944,"MAN",1883,1882,"#6C1D45","#99D6EA",2],
  ["chelsea","Chelsea","Chelsea FC","London","GB","Stamford Bridge",51.4817,-0.1910,40343,"LHR",1877,1905,"#034694","#FFFFFF",6],
  ["crystal-palace","Crystal Palace","Crystal Palace FC","London","GB","Selhurst Park",51.3983,-0.0855,25486,"LGW",1924,1905,"#1B458F","#C4122E",0],
  ["everton","Everton","Everton FC","Liverpool","GB","Hill Dickinson Stadium",53.4074,-2.9917,52888,"LPL",2025,1878,"#003399","#FFFFFF",9],
  ["fulham","Fulham","Fulham FC","London","GB","Craven Cottage",51.4750,-0.2217,29600,"LHR",1896,1879,"#FFFFFF","#000000",0],
  ["leeds","Leeds","Leeds United","Leeds","GB","Elland Road",53.7778,-1.5722,37792,"LBA",1897,1919,"#FFFFFF","#1D428A",3],
  ["liverpool","Liverpool","Liverpool FC","Liverpool","GB","Anfield",53.4308,-2.9608,61276,"LPL",1884,1892,"#C8102E","#00B2A9",20],
  ["man-city","Man City","Manchester City","Manchester","GB","Etihad Stadium",53.4831,-2.2004,53400,"MAN",2003,1880,"#6CABDD","#1C2C5B",10],
  ["man-united","Man United","Manchester United","Manchester","GB","Old Trafford",53.4631,-2.2913,74310,"MAN",1910,1878,"#DA291C","#FBE122",20],
  ["newcastle","Newcastle","Newcastle United","Newcastle","GB","St James' Park",54.9756,-1.6217,52305,"NCL",1892,1892,"#241F20","#FFFFFF",4],
  ["nottingham-forest","Forest","Nottingham Forest","Nottingham","GB","City Ground",52.9400,-1.1329,30404,"EMA",1898,1865,"#DD0000","#FFFFFF",1],
  ["sunderland","Sunderland","Sunderland AFC","Sunderland","GB","Stadium of Light",54.9145,-1.3882,49000,"NCL",1997,1879,"#EB172B","#FFFFFF",6],
  ["tottenham","Spurs","Tottenham Hotspur","London","GB","Tottenham Hotspur Stadium",51.6043,-0.0665,62850,"LHR",2019,1882,"#132257","#FFFFFF",2],
  ["west-ham","West Ham","West Ham United","London","GB","London Stadium",51.5387,-0.0166,62500,"LCY",2016,1895,"#7A263A","#1BB1E7",0],
  ["wolves","Wolves","Wolverhampton Wanderers","Wolverhampton","GB","Molineux Stadium",52.5902,-2.1303,31750,"BHX",1889,1877,"#FDB913","#231F20",3],
];

// ---------------------------------------------------------------------------
// NFL
// ---------------------------------------------------------------------------
const NFL_ROWS: Row[] = [
  ["cardinals","Cardinals","Arizona Cardinals","Glendale","US","State Farm Stadium",33.5276,-112.2626,63400,"PHX",2006,1898,"#97233F","#000000",2],
  ["falcons","Falcons","Atlanta Falcons","Atlanta","US","Mercedes-Benz Stadium",33.7554,-84.4008,71000,"ATL",2017,1966,"#A71930","#000000",0],
  ["ravens","Ravens","Baltimore Ravens","Baltimore","US","M&T Bank Stadium",39.2780,-76.6227,71008,"BWI",1998,1996,"#241773","#000000",2],
  ["bills","Bills","Buffalo Bills","Orchard Park","US","Highmark Stadium",42.7738,-78.7870,71608,"BUF",1973,1960,"#00338D","#C60C30",0],
  ["panthers","Panthers","Carolina Panthers","Charlotte","US","Bank of America Stadium",35.2258,-80.8528,74867,"CLT",1996,1993,"#0085CA","#101820",0],
  ["bears","Bears","Chicago Bears","Chicago","US","Soldier Field",41.8623,-87.6167,61500,"ORD",1924,1920,"#0B162A","#C83803",1],
  ["bengals","Bengals","Cincinnati Bengals","Cincinnati","US","Paycor Stadium",39.0955,-84.5161,65515,"CVG",2000,1968,"#FB4F14","#000000",0],
  ["browns","Browns","Cleveland Browns","Cleveland","US","Huntington Bank Field",41.5061,-81.6995,67431,"CLE",1999,1946,"#311D00","#FF3C00",0],
  ["cowboys","Cowboys","Dallas Cowboys","Arlington","US","AT&T Stadium",32.7473,-97.0945,80000,"DFW",2009,1960,"#003594","#869397",5],
  ["broncos","Broncos","Denver Broncos","Denver","US","Empower Field at Mile High",39.7439,-105.0201,76125,"DEN",2001,1960,"#FB4F14","#002244",3],
  ["lions","Lions","Detroit Lions","Detroit","US","Ford Field",42.3400,-83.0456,65000,"DTW",2002,1930,"#0076B6","#B0B7BC",0],
  ["packers","Packers","Green Bay Packers","Green Bay","US","Lambeau Field",44.5013,-88.0622,81441,"GRB",1957,1919,"#203731","#FFB612",4],
  ["texans","Texans","Houston Texans","Houston","US","NRG Stadium",29.6847,-95.4107,72220,"IAH",2002,2002,"#03202F","#A71930",0],
  ["colts","Colts","Indianapolis Colts","Indianapolis","US","Lucas Oil Stadium",39.7601,-86.1639,67000,"IND",2008,1953,"#002C5F","#A2AAAD",2],
  ["jaguars","Jaguars","Jacksonville Jaguars","Jacksonville","US","EverBank Stadium",30.3239,-81.6373,67814,"JAX",1995,1993,"#101820","#D7A22A",0],
  ["chiefs","Chiefs","Kansas City Chiefs","Kansas City","US","GEHA Field at Arrowhead",39.0489,-94.4839,76416,"MCI",1972,1960,"#E31837","#FFB81C",4],
  ["raiders","Raiders","Las Vegas Raiders","Las Vegas","US","Allegiant Stadium",36.0909,-115.1833,65000,"LAS",2020,1960,"#000000","#A5ACAF",3],
  ["chargers","Chargers","Los Angeles Chargers","Inglewood","US","SoFi Stadium",33.9535,-118.3392,70240,"LAX",2020,1960,"#0080C6","#FFC20E",0],
  ["rams","Rams","Los Angeles Rams","Inglewood","US","SoFi Stadium",33.9535,-118.3392,70240,"LAX",2020,1936,"#003594","#FFA300",2],
  ["dolphins","Dolphins","Miami Dolphins","Miami Gardens","US","Hard Rock Stadium",25.9580,-80.2389,65326,"MIA",1987,1966,"#008E97","#FC4C02",2],
  ["vikings","Vikings","Minnesota Vikings","Minneapolis","US","U.S. Bank Stadium",44.9738,-93.2578,66655,"MSP",2016,1960,"#4F2683","#FFC62F",0],
  ["patriots","Patriots","New England Patriots","Foxborough","US","Gillette Stadium",42.0909,-71.2643,64628,"BOS",2002,1959,"#002244","#C60C30",6],
  ["saints","Saints","New Orleans Saints","New Orleans","US","Caesars Superdome",29.9511,-90.0812,73208,"MSY",1975,1967,"#D3BC8D","#101820",1],
  ["giants","Giants","New York Giants","East Rutherford","US","MetLife Stadium",40.8135,-74.0745,82500,"EWR",2010,1925,"#0B2265","#A71930",4],
  ["jets","Jets","New York Jets","East Rutherford","US","MetLife Stadium",40.8135,-74.0745,82500,"EWR",2010,1959,"#125740","#FFFFFF",1],
  ["eagles","Eagles","Philadelphia Eagles","Philadelphia","US","Lincoln Financial Field",39.9008,-75.1675,69796,"PHL",2003,1933,"#004C54","#A5ACAF",2],
  ["steelers","Steelers","Pittsburgh Steelers","Pittsburgh","US","Acrisure Stadium",40.4468,-80.0158,68400,"PIT",2001,1933,"#FFB612","#101820",6],
  ["49ers","49ers","San Francisco 49ers","Santa Clara","US","Levi's Stadium",37.4033,-121.9694,68500,"SJC",2014,1946,"#AA0000","#B3995D",5],
  ["seahawks","Seahawks","Seattle Seahawks","Seattle","US","Lumen Field",47.5952,-122.3316,68740,"SEA",2002,1976,"#002244","#69BE28",1],
  ["buccaneers","Buccaneers","Tampa Bay Buccaneers","Tampa","US","Raymond James Stadium",27.9759,-82.5033,65890,"TPA",1998,1976,"#D50A0A","#0A0A08",2],
  ["titans","Titans","Tennessee Titans","Nashville","US","Nissan Stadium",36.1665,-86.7713,69143,"BNA",1999,1960,"#0C2340","#4B92DB",0],
  ["commanders","Commanders","Washington Commanders","Landover","US","Northwest Stadium",38.9077,-76.8645,67617,"DCA",1997,1932,"#5A1414","#FFB612",3],
];

const nba = expand(NBA_ROWS, "nba", "basketball");
const epl = expand(EPL_ROWS, "premier-league", "soccer");
const nfl = expand(NFL_ROWS, "nfl", "american-football");

export const TEAMS: Team[] = [...nba.teams, ...epl.teams, ...nfl.teams];

/**
 * Venues used by marquee events that aren't any club's home ground — neutral
 * finals, tournament sites, and circuits.
 */
export const NEUTRAL_VENUES: Venue[] = [
  { id: "wembley", name: "Wembley Stadium", city: "London", country: "GB", lat: 51.5560, lon: -0.2795, capacity: 90000, nearestAirport: "LHR", opened: 2007 },
  { id: "aewc", name: "All England Club", city: "London", country: "GB", lat: 51.4340, lon: -0.2144, capacity: 42000, nearestAirport: "LHR", opened: 1922 },
  { id: "roland-garros", name: "Stade Roland-Garros", city: "Paris", country: "FR", lat: 48.8470, lon: 2.2500, capacity: 34000, nearestAirport: "CDG", opened: 1928 },
  { id: "flushing-meadows", name: "USTA Billie Jean King Center", city: "New York", country: "US", lat: 40.7500, lon: -73.8458, capacity: 45000, nearestAirport: "JFK", opened: 1978 },
  { id: "melbourne-park", name: "Melbourne Park", city: "Melbourne", country: "AU", lat: -37.8216, lon: 144.9784, capacity: 40000, nearestAirport: "MEL", opened: 1988 },
  { id: "monaco-circuit", name: "Circuit de Monaco", city: "Monte Carlo", country: "MC", lat: 43.7347, lon: 7.4206, capacity: 37000, nearestAirport: "NCE", opened: 1929 },
  { id: "silverstone", name: "Silverstone Circuit", city: "Silverstone", country: "GB", lat: 52.0733, lon: -1.0142, capacity: 164000, nearestAirport: "BHX", opened: 1948 },
  { id: "monza", name: "Autodromo Nazionale Monza", city: "Monza", country: "IT", lat: 45.6156, lon: 9.2811, capacity: 115000, nearestAirport: "MXP", opened: 1922 },
  { id: "suzuka", name: "Suzuka International Circuit", city: "Suzuka", country: "JP", lat: 34.8431, lon: 136.5410, capacity: 155000, nearestAirport: "NGO", opened: 1962 },
  { id: "cota", name: "Circuit of the Americas", city: "Austin", country: "US", lat: 30.1328, lon: -97.6411, capacity: 120000, nearestAirport: "AUS", opened: 2012 },
  { id: "le-mans", name: "Circuit de la Sarthe", city: "Le Mans", country: "FR", lat: 47.9560, lon: 0.2074, capacity: 260000, nearestAirport: "CDG", opened: 1923 },
  { id: "augusta", name: "Augusta National Golf Club", city: "Augusta", country: "US", lat: 33.5021, lon: -82.0227, capacity: 40000, nearestAirport: "AGS", opened: 1933 },
  { id: "st-andrews", name: "Old Course at St Andrews", city: "St Andrews", country: "GB", lat: 56.3433, lon: -2.8025, capacity: 50000, nearestAirport: "EDI", opened: 1552 },
  { id: "t-mobile-arena", name: "T-Mobile Arena", city: "Las Vegas", country: "US", lat: 36.1029, lon: -115.1783, capacity: 20000, nearestAirport: "LAS", opened: 2016 },
  { id: "sphere", name: "Sphere", city: "Las Vegas", country: "US", lat: 36.1207, lon: -115.1620, capacity: 18600, nearestAirport: "LAS", opened: 2023 },
  { id: "lords", name: "Lord's Cricket Ground", city: "London", country: "GB", lat: 51.5297, lon: -0.1727, capacity: 31100, nearestAirport: "LHR", opened: 1814 },
  { id: "mcg", name: "Melbourne Cricket Ground", city: "Melbourne", country: "AU", lat: -37.8200, lon: 144.9834, capacity: 100024, nearestAirport: "MEL", opened: 1853 },
  { id: "narendra-modi", name: "Narendra Modi Stadium", city: "Ahmedabad", country: "IN", lat: 23.0919, lon: 72.5975, capacity: 132000, nearestAirport: "AMD", opened: 1983 },
  { id: "wankhede", name: "Wankhede Stadium", city: "Mumbai", country: "IN", lat: 18.9389, lon: 72.8258, capacity: 33108, nearestAirport: "BOM", opened: 1974 },
  { id: "estadio-azteca", name: "Estadio Azteca", city: "Mexico City", country: "MX", lat: 19.3029, lon: -99.1505, capacity: 87000, nearestAirport: "MEX", opened: 1966 },
  { id: "bernabeu", name: "Santiago Bernabéu", city: "Madrid", country: "ES", lat: 40.4531, lon: -3.6883, capacity: 78297, nearestAirport: "MAD", opened: 1947 },
  { id: "camp-nou", name: "Spotify Camp Nou", city: "Barcelona", country: "ES", lat: 41.3809, lon: 2.1228, capacity: 105000, nearestAirport: "BCN", opened: 1957 },
  { id: "san-siro", name: "San Siro", city: "Milan", country: "IT", lat: 45.4781, lon: 9.1240, capacity: 75923, nearestAirport: "MXP", opened: 1926 },
  { id: "allianz-arena", name: "Allianz Arena", city: "Munich", country: "DE", lat: 48.2188, lon: 11.6247, capacity: 75024, nearestAirport: "MUC", opened: 2005 },
  { id: "maracana", name: "Estádio do Maracanã", city: "Rio de Janeiro", country: "BR", lat: -22.9121, lon: -43.2302, capacity: 78838, nearestAirport: "GIG", opened: 1950 },
  { id: "msg-neutral", name: "Madison Square Garden", city: "New York", country: "US", lat: 40.7505, lon: -73.9934, capacity: 20789, nearestAirport: "JFK", opened: 1968 },
  { id: "bell-centre", name: "Bell Centre", city: "Montreal", country: "CA", lat: 45.4961, lon: -73.5693, capacity: 21105, nearestAirport: "YUL", opened: 1996 },
];

export const VENUES = [
  ...nba.venues,
  ...epl.venues,
  // MetLife and SoFi are each shared by two NFL clubs; `expand` emits a venue
  // row per team, so dedupe by id before building the lookup map.
  ...nfl.venues.filter(
    (v, i, all) => all.findIndex((o) => o.name === v.name) === i,
  ),
  ...NEUTRAL_VENUES,
];

export const TEAMS_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

/**
 * Venue lookup. Built from `VENUES` but also maps every shared-stadium team's
 * own venue id onto the deduped record, so `venuesById.get(team.venueId)`
 * always resolves.
 */
export const VENUES_BY_ID = new Map(VENUES.map((v) => [v.id, v]));
for (const v of nfl.venues) {
  if (!VENUES_BY_ID.has(v.id)) {
    const canonical = VENUES.find((o) => o.name === v.name);
    if (canonical) VENUES_BY_ID.set(v.id, canonical);
  }
}

export function teamsForLeague(leagueId: string): Team[] {
  return TEAMS.filter((t) => t.leagueId === leagueId).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
