export interface KBDocument {
  id: string;
  category: string;
  title: string;
  content: string;
}

const STADIUM_POLICIES: KBDocument[] = [
  {
    id: 'overview',
    category: 'General Info',
    title: 'MetLife Stadium Overview & Capacity',
    content:
      'MetLife Stadium is a multipurpose sports and entertainment venue located at 1 MetLife Stadium Drive, East Rutherford, New Jersey, USA. Opened on April 10, 2010, it is home to the NFL New York Giants and New York Jets. The stadium has a capacity of 82,500 seats. It hosts NFL Games, Concerts, FIFA Club World Cup Matches, and the FIFA World Cup 2026 Final.',
  },
  {
    id: 'transportation-parking',
    category: 'Transportation',
    title: 'Transportation and Parking Guidelines',
    content:
      'Transportation options: By Train: NJ Transit Meadowlands Station opens during major events. By Bus: Coach USA Meadowlands Express and NJ Transit bus services operate. By Car: Accessible from NJ Turnpike Exits 16W and 19W. Parking lots open before events; pre-purchased parking passes are highly encouraged.',
  },
  {
    id: 'entrances-gates',
    category: 'Security & Entry',
    title: 'Entrances and Gates',
    content:
      'Public entry gates include North Gate, South Gate, East Gate, and West Gate. Guests should check their tickets and use the specified entry gate. All gates open 3 hours prior to kickoff.',
  },
  {
    id: 'accessibility',
    category: 'Accessibility',
    title: 'ADA and Accessibility Services',
    content:
      'MetLife Stadium provides wheelchair accessible seating, accessible entrances, accessible restrooms, elevators, and guest assistance services. Gate D (West Gate) is designated as the primary ADA Accessible Entrance with specialized wide scanning lanes and elevator access.',
  },
  {
    id: 'stroller-policy',
    category: 'Accessibility & Family',
    title: 'Stroller Policy',
    content:
      'Strollers are permitted inside the stadium but cannot be brought into the seating bowls. Strollers must be checked in at the Guest Services booths located near Gate A (East Gate) or Gate D (West Gate).',
  },
  {
    id: 'bag-policy',
    category: 'Security & Entry',
    title: 'Bag Policy Guidelines',
    content:
      'Allowed: One clear plastic, vinyl, or PVC bag max 12" x 6" x 12", one-gallon clear freezer bag, small clutch purse max 4.5" x 6.5", and medically necessary bags after inspection. Prohibited: Backpacks, large purses, duffel bags, non-clear oversized bags. All bags are subject to inspection.',
  },
  {
    id: 'water-bottle-policy',
    category: 'Security & Entry',
    title: 'Water Bottle Rules',
    content:
      'Allowed: One factory-sealed plastic water bottle up to 20 ounces. Reusable empty plastic or aluminum water bottles may be permitted depending on event rules. Not Allowed: Glass bottles, large containers, unapproved liquid containers.',
  },
  {
    id: 'food-policy',
    category: 'Guest Services',
    title: 'Food Guidelines',
    content:
      'Guests may bring small amounts of food packed in approved clear bags. All food items are subject to security screening and inspection.',
  },
  {
    id: 'prohibited-items',
    category: 'Security & Entry',
    title: 'Prohibited Items List',
    content:
      'Prohibited: Weapons, firearms, fireworks, explosives, illegal substances, large umbrellas, laser pointers, aerosol cans, smoke devices, drones, and professional camera equipment without authorization.',
  },
  {
    id: 'security-screening',
    category: 'Security & Entry',
    title: 'Security Screening Requirements',
    content:
      'All guests must pass through security screening (metal detectors, bag checks, removing items for inspection) before entering the stadium.',
  },
  {
    id: 're-entry',
    category: 'Security & Entry',
    title: 'Re-entry Policy',
    content:
      'Once a guest exits the stadium, re-entry is generally not permitted unless specifically stated for the event.',
  },
  {
    id: 'fan-services',
    category: 'Guest Services',
    title: 'Fan and Guest Services Centers',
    content:
      'Available services include Guest Services Centers (near Gates A and D), Lost and Found, First Aid Stations, Family Restrooms, and Information Desks.',
  },
  {
    id: 'dining',
    category: 'Dining',
    title: 'Dining and Food Options',
    content:
      'The stadium offers food courts, snack stands, and beverage stands. Dietary options include vegetarian, gluten-free, and kosher options at select locations.',
  },
  {
    id: 'emergency-assistance',
    category: 'Guest Services',
    title: 'Emergency Assistance Guidelines',
    content:
      'In case of emergency, contact the nearest stadium staff member, visit a Guest Services Center, or follow the emergency announcements displayed on the stadium screens.',
  },
];

// Simple tokenizer to parse terms
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

// Search function using TF-IDF / term-frequency overlap score
export function searchVenueKB(query: string, limit = 2): KBDocument[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return STADIUM_POLICIES.slice(0, limit);

  const scoredDocs = STADIUM_POLICIES.map((doc) => {
    const docTokens = tokenize(`${doc.title} ${doc.content}`);

    // Calculate simple word frequency overlap score
    let score = 0;
    queryTokens.forEach((token) => {
      // Direct match
      const occurrences = docTokens.filter((t) => t === token).length;
      score += occurrences * 1.5;

      // Substring match
      if (occurrences === 0) {
        const partialMatches = docTokens.filter(
          (t) => t.includes(token) || token.includes(t),
        ).length;
        score += partialMatches * 0.5;
      }
    });

    return { doc, score };
  });

  // Sort by score descending and filter out docs with zero score (unless no docs match)
  const sorted = scoredDocs
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.doc);

  if (sorted.length === 0) {
    return STADIUM_POLICIES.slice(0, limit);
  }

  return sorted.slice(0, limit);
}
