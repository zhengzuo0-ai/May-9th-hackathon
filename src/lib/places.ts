export type CivPlace = {
  name: string;
  lat: number;
  lng: number;
  blurb: string;
};

const civPlaces: CivPlace[] = [
  {
    name: "Abidjan",
    lat: 5.36,
    lng: -4.0083,
    blurb: "Economic capital, southern coast",
  },
  {
    name: "Yamoussoukro",
    lat: 6.8276,
    lng: -5.2893,
    blurb: "Political capital, central CI",
  },
  {
    name: "Bouaké",
    lat: 7.6939,
    lng: -5.0303,
    blurb: "Third city, north of Bandama",
  },
  {
    name: "Yaouré",
    lat: 6.9,
    lng: -5.18,
    blurb: "Perseus Yaouré gold mine area",
  },
  {
    name: "Kokumbo",
    lat: 6.32,
    lng: -5.41,
    blurb: "Bandama corridor ASM area",
  },
];

const placeAliases: Record<string, string> = {
  yaoure: "Yaouré",
  bouake: "Bouaké",
};

function normalize(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function findPlace(query: string): CivPlace | undefined {
  const key = normalize(query);
  if (!key) return undefined;
  const aliased = placeAliases[key];
  if (aliased) {
    return civPlaces.find((place) => place.name === aliased);
  }
  return civPlaces.find((place) => normalize(place.name) === key);
}

export function listPlaceNames(): string[] {
  return civPlaces.map((place) => place.name);
}
