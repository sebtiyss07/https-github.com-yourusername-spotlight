/**
 * Venue photos from Wikimedia Commons, each the lead image of the venue's
 * Wikipedia article. All are Creative Commons licensed, which requires the
 * credit line and licence shown wherever the photo appears (see `PhotoCredit`).
 * Hot-linked from Wikimedia, which allows it.
 *
 * Football grounds are keyed by home team; F1 entries (`f1:<circuit>`) are
 * track maps, drawn as an outline rather than a photo.
 */
export interface VenuePhoto {
  /** The original on Wikimedia (kept for reference; we serve local copies). */
  src: string;
  /** Local copies in /public/photos, 1280px and 330px wide. */
  large?: string;
  small?: string;
  credit: string;
  license: string;
  /** The file's Commons page, with full licence details. */
  page: string;
}

export const VENUE_PHOTOS: Record<string, VenuePhoto> = {
  arsenal: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/London_Emirates_Stadium_arsenal.jpg/1920px-London_Emirates_Stadium_arsenal.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:London_Emirates_Stadium_arsenal.jpg" },
  "aston-villa": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Birmingham_aston_villa_park_stadium.jpg/1920px-Birmingham_aston_villa_park_stadium.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:Birmingham_aston_villa_park_stadium.jpg" },
  bournemouth: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Deancourt_14092013_vblackpool.jpg/1920px-Deancourt_14092013_vblackpool.jpg", credit: "Matthew Jackson", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Deancourt_14092013_vblackpool.jpg" },
  brentford: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Brentford_Community_Stadium_2020.jpg/1920px-Brentford_Community_Stadium_2020.jpg", credit: "AndyScott", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Brentford_Community_Stadium_2020.jpg" },
  brighton: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Amex_Community_Stadium.jpg/1920px-Amex_Community_Stadium.jpg", credit: "Barbara van Cleve", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Amex_Community_Stadium.jpg" },
  chelsea: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/London_Stamford_Bridge.jpg/1920px-London_Stamford_Bridge.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:London_Stamford_Bridge.jpg" },
  coventry: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Coventry_Derby_October_2021_-_2.jpg/1920px-Coventry_Derby_October_2021_-_2.jpg", credit: "Amakuru", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Coventry_Derby_October_2021_-_2.jpg" },
  "crystal-palace": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/2023_09_09_arne_mueseler_17_18_07_00743-Verbessert-RR_%2853283239217%29.jpg/1920px-2023_09_09_arne_mueseler_17_18_07_00743-Verbessert-RR_%2853283239217%29.jpg", credit: "Arne Müseler", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:2023_09_09_arne_mueseler_17_18_07_00743-Verbessert-RR_(53283239217).jpg" },
  everton: { src: "https://upload.wikimedia.org/wikipedia/commons/9/95/Hill_Dickinson_Stadium%2C_Liverpool_Waterfront_-_geograph.org.uk_-_8170881.jpg", credit: "David Dixon", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:Hill_Dickinson_Stadium,_Liverpool_Waterfront_-_geograph.org.uk_-_8170881.jpg" },
  fulham: { src: "https://upload.wikimedia.org/wikipedia/commons/a/af/Craven_Cottage_-_geograph.org.uk_-_7559163.jpg", credit: "Elliot Smith", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:Craven_Cottage_-_geograph.org.uk_-_7559163.jpg" },
  hull: { src: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Match_day_at_the_KC_Stadium_-_geograph.org.uk_-_1497910.jpg", credit: "David Brown", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:Match_day_at_the_KC_Stadium_-_geograph.org.uk_-_1497910.jpg" },
  ipswich: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Portman_Road_aerial_%28cropped%29.jpg/1920px-Portman_Road_aerial_%28cropped%29.jpg", credit: "John Fielding", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Portman_Road_aerial_(cropped).jpg" },
  leeds: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Leeds_United_-_31559864360.jpg/1920px-Leeds_United_-_31559864360.jpg", credit: "chillilogic.com", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Leeds_United_-_31559864360.jpg" },
  liverpool: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Liverpool_anfield_road_stadium.jpg/1920px-Liverpool_anfield_road_stadium.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:Liverpool_anfield_road_stadium.jpg" },
  "man-city": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/City_of_Manchester_Stadium_2023_cropped.jpg/1920px-City_of_Manchester_Stadium_2023_cropped.jpg", credit: "Arne Müseler, cropped by Blackcat", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:City_of_Manchester_Stadium_2023_cropped.jpg" },
  "man-united": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/2023_07_31_arne_mueseler_00060-Verbessert-RR_%2853106651455%29.jpg/1920px-2023_07_31_arne_mueseler_00060-Verbessert-RR_%2853106651455%29.jpg", credit: "Arne Müseler", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:2023_07_31_arne_mueseler_00060-Verbessert-RR_(53106651455).jpg" },
  newcastle: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Newcastle_st-james-park_stadium.jpg/1920px-Newcastle_st-james-park_stadium.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:Newcastle_st-james-park_stadium.jpg" },
  "nottingham-forest": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/CityGroundFromAboveTrentBridgeCricketGround.jpg/1920px-CityGroundFromAboveTrentBridgeCricketGround.jpg", credit: "Stadisimo", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:CityGroundFromAboveTrentBridgeCricketGround.jpg" },
  sunderland: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Sunderland_stadium_of_light.jpg/1920px-Sunderland_stadium_of_light.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:Sunderland_stadium_of_light.jpg" },
  tottenham: { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/London_Tottenham_Hotspur_Stadium.jpg/1920px-London_Tottenham_Hotspur_Stadium.jpg", credit: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:London_Tottenham_Hotspur_Stadium.jpg" },
  "f1:sepang": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Sepang.svg/1920px-Sepang.svg.png", credit: "Will Pittenger", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Sepang.svg" },
  "f1:marina_bay": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Marina_Bay_circuit_2023.svg/1920px-Marina_Bay_circuit_2023.svg.png", credit: "Cherkash", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Marina_Bay_circuit_2023.svg" },
  "f1:americas": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Austin_circuit.svg/1920px-Austin_circuit.svg.png", credit: "Gustavo Girardelli", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:Austin_circuit.svg" },
  "f1:rodriguez": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez_2015.svg/1920px-Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez_2015.svg.png", credit: "Pitlane02", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez_2015.svg" },
  "f1:interlagos": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace_%28AKA_Interlagos%29_track_map.svg/1920px-Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace_%28AKA_Interlagos%29_track_map.svg.png", credit: "Will Pittenger", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace_(AKA_Interlagos)_track_map.svg" },
  "f1:vegas": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/2023_Las_Vegas_street_circuit.svg/1920px-2023_Las_Vegas_street_circuit.svg.png", credit: "Valentin JJ.", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:2023_Las_Vegas_street_circuit.svg" },
  "f1:losail": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Lusail_International_Circuit_2023.svg/1920px-Lusail_International_Circuit_2023.svg.png", credit: "Will Pittenger, Gpmat", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Lusail_International_Circuit_2023.svg" },
  "f1:yas_marina": { src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Yas_Marina_Circuit.png/1920px-Yas_Marina_Circuit.png", credit: "Anthony Alessio Tralongo", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Yas_Marina_Circuit.png" },
};

/**
 * The photo with its local copies. Serving our own copies (saved from the
 * Commons thumbnails, licence permitting) means pages never depend on
 * Wikimedia's hot-link rate limits.
 */
export function venuePhotoFor(key: string): VenuePhoto | null {
  const photo = VENUE_PHOTOS[key];
  if (!photo) return null;
  const ext = photo.src.endsWith(".png") ? "png" : "jpg";
  const base = `/photos/${key.replace(":", "-")}`;
  return { ...photo, large: `${base}-1280.${ext}`, small: `${base}-330.${ext}` };
}
