import { Product, BillItem, UnitType } from '../types';

export interface ParsedVoiceItem {
  matchedProduct?: Product;
  name: string;
  hindiName?: string;
  quantity: number;
  unit: UnitType;
  rate: number;
  total: number;
  needsRate?: boolean;
  confidence: number;
}

export interface ParsedVoiceCommand {
  rawTranscript: string;
  action: 'add_item' | 'unknown';
  item?: ParsedVoiceItem; // The primary/first item (for backward compatibility)
  items: ParsedVoiceItem[]; // Array of all items recognized in the utterance (1 or more)
  feedbackMessage: string;
  success: boolean;
}

// Check Web Speech API support
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

// Get SpeechRecognition instance constructor
export function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Word to number mapping (English & Hindi/Hinglish)
const WORD_TO_NUMBER: Record<string, number> = {
  half: 0.5,
  'half a': 0.5,
  quarter: 0.25,
  aadha: 0.5,
  adha: 0.5,
  paav: 0.25,
  pav: 0.25,
  dedh: 1.5,
  dhai: 2.5,
  sawa: 1.25,
  paune: 0.75,
  one: 1,
  ek: 1,
  two: 2,
  do: 2,
  three: 3,
  teen: 3,
  four: 4,
  char: 4,
  chaar: 4,
  five: 5,
  paanch: 5,
  panch: 5,
  six: 6,
  chhe: 6,
  che: 6,
  seven: 7,
  saat: 7,
  eight: 8,
  aath: 8,
  nine: 9,
  nau: 9,
  ten: 10,
  das: 10,
  eleven: 11,
  gyarah: 11,
  twelve: 12,
  barah: 12,
  fifteen: 15,
  pandrah: 15,
  twenty: 20,
  bees: 20,
  twentyfive: 25,
  pachees: 25,
  thirty: 30,
  tees: 30,
  chalis: 40,
  fifty: 50,
  pachas: 50,
  hundred: 100,
  sau: 100,
  twohundred: 200,
  dosau: 200,
  fivehundred: 500,
  panchsau: 500,
  kilo: 1,
};

// Unit aliases normalization
const UNIT_ALIASES: Record<string, UnitType> = {
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  packet: 'packet',
  packets: 'packet',
  pkt: 'packet',
  pkts: 'packet',
  pack: 'packet',
  packs: 'packet',
  pouch: 'packet',
  pouches: 'packet',
  litre: 'litre',
  litres: 'litre',
  liter: 'litre',
  liters: 'litre',
  ltr: 'litre',
  ltrs: 'litre',
  l: 'litre',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  nag: 'piece',
  dabba: 'piece',
  box: 'piece',
  bottle: 'piece',
  bottles: 'piece',
  quintal: 'quintal',
  qtl: 'quintal',
  bori: 'quintal',
  kattah: 'quintal',
};

// Common Indian Kirana aliases to match quickly
const KIRANA_ALIASES: Record<string, string[]> = {
  'Sugar / Cheeni M30': ['sugar', 'cheeni', 'chini', 'shakkar', 'sakkar', 'sugar m30', 'sakhar'],
  'Tata Salt Iodized 1kg': ['tata salt', 'salt', 'namak', 'tata namak', 'iodized salt', 'packet namak'],
  'Haldi Powder (Turmeric)': ['haldi', 'turmeric', 'haldi powder', 'pisi haldi', 'haldi patti'],
  'Jeera (Cumin Seeds)': ['jeera', 'cumin', 'cumin seeds', 'jira', 'zeera'],
  'Dhaniya Powder (Coriander)': ['dhaniya', 'coriander', 'dhaniya powder', 'dhania', 'dhania powder'],
  'Lal Mirch Powder (Red Chilli)': ['lal mirch', 'red chilli', 'chilli powder', 'mirch', 'mirchi', 'kutti mirch'],
  'Garam Masala Special': ['garam masala', 'shahi garam masala', 'masala', 'sabzi masala'],
  'Chhoti Elaichi (Green Cardamom)': ['elaichi', 'chhoti elaichi', 'cardamom', 'green cardamom', 'hari elaichi'],
  'Sabut Kali Mirch (Black Pepper)': ['kali mirch', 'black pepper', 'pepper', 'sabut kali mirch'],
  'Laung (Cloves)': ['laung', 'clove', 'cloves', 'lavang'],
  'Dalchini (Cinnamon Bark)': ['dalchini', 'cinnamon'],
  'Badi Elaichi (Black Cardamom)': ['badi elaichi', 'black cardamom', 'moti elaichi'],
  'Rai / Sarson (Mustard Seeds)': ['rai', 'sarson', 'mustard', 'sarson daana', 'mustard seeds'],
  'Saunf (Fennel Seeds)': ['saunf', 'fennel', 'sonf', 'badi saunf'],
  'Ajwain (Carom Seeds)': ['ajwain', 'carom seeds', 'ajwayan'],
  'Kasuri Methi': ['kasuri methi', 'methi', 'kastoori methi'],
  'Asafoetida (Hing Vandevi 50g)': ['hing', 'asafoetida', 'vandevi hing'],
  'Biryani Masala (Pack 100g)': ['biryani masala', 'biryani pack'],
  'Kashmiri Mirch (Deggi)': ['kashmiri mirch', 'deggi mirch'],
  'Amchur Powder (Dry Mango)': ['amchur', 'aamchur', 'dry mango powder', 'khatai'],
  'Toor Dal (Arhar Dal)': ['toor dal', 'arhar dal', 'tuvar dal', 'toor', 'arhar', 'dal', 'daal', 'toor daal', 'arhar daal', 'yellow dal'],
  'Moong Dal Dhuli (Yellow)': ['moong dal', 'moong', 'dhuli moong', 'yellow moong', 'moong daal', 'mung dal'],
  'Chana Dal': ['chana dal', 'chane ki dal', 'chana daal'],
  'Urad Dal Dhuli (White)': ['urad dal', 'dhuli urad', 'white urad', 'urad daal'],
  'Kabuli Chana (White Chickpeas)': ['kabuli chana', 'chole', 'white chana', 'chickpeas'],
  'Kala Chana (Desi Gram)': ['kala chana', 'desi chana', 'black chana'],
  'Rajma Chitra (Kidney Beans)': ['rajma', 'rajma chitra', 'kidney beans'],
  'Chakki Fresh Sharbati Atta': ['atta', 'aata', 'wheat flour', 'sharbati atta', 'chakki atta', 'gehun atta', 'flour'],
  'Basmati Rice Daily Feast': ['rice', 'chawal', 'basmati rice', 'basmati chawal', 'daily rice', 'plain rice'],
  'Basmati Premium Royal 1121': ['1121 rice', 'royal basmati', 'premium basmati'],
  'Maida (Refined Flour)': ['maida', 'refined flour'],
  'Sooji / Rava (Semolina)': ['sooji', 'suji', 'rava', 'semolina'],
  'Poha (Beaten Rice)': ['poha', 'powa', 'flattened rice', 'chivda'],
  'Sarson Ka Kachi Ghani Tel': ['sarson tel', 'mustard oil', 'kachi ghani', 'sarson oil', 'oil', 'tel', 'sarson ka tel', 'kachi ghani tel'],
  'Refined Sunflower Oil 1L': ['refined oil', 'sunflower oil', 'fortune oil', 'refined tel', 'sunflower tel'],
  'Shuddh Desi Cow Ghee': ['ghee', 'cow ghee', 'desi ghee', 'shuddh ghee', 'asli ghee'],
  'Kaju W320 (Cashews)': ['kaju', 'cashew', 'cashews'],
  'Badam Giri (California Almonds)': ['badam', 'almond', 'almonds', 'badam giri'],
  'Kishmish (Green Raisins)': ['kishmish', 'raisins', 'kismis'],
  'Saindhav Sendha Namak (Rock Salt)': ['sendha namak', 'rock salt', 'vrat namak', 'lahori namak'],
  'Tea Gold Leaf Premium': ['tea', 'chai', 'chai patti', 'tea leaf', 'tea powder', 'patti'],
  'Jaggery / Gud Desi Bheli': ['gud', 'jaggery', 'gur'],
};

/**
 * Splits an utterance into individual item segments.
 * Supports:
 * - Conjunctions: "and", "&", "+", "plus", "aur", "tatha", "evam", "with", "along with", "saath mein", "saath me"
 * - Punctuation: commas ",", semicolons ";"
 * - Unpunctuated concatenations: e.g. "1kg rice 500g dal"
 */
export function splitUtteranceIntoSegments(transcript: string): string[] {
  let text = transcript.trim();
  if (!text) return [];

  // Remove leading conversational fillers and action verbs from the beginning
  text = text.replace(/^(?:please|kripya|bhai|hello|hey nayab|nayab|ok|sunoji)\s+/i, '');
  text = text.replace(/^(?:add|plus|put|insert|daalo|jodo|shamil karo|write)\s+/i, '');

  // Split on explicit conjunctions and punctuation delimiters
  // Also treat 'or' as a separator when followed by a number or common item quantity word
  const explicitDelimiters = /(?:,\s*|\s*;\s*|\s+(?:and|&|\+|plus|aur|tatha|evam|with|along with|saath mein|saath me)\s+|\s+or\s+(?=\d|\b(?:half|aadha|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|chaar|paanch|chhe|saat|aath|nau|das)\b|[a-z]+\s+\d))/gi;

  const rawChunks = text.split(explicitDelimiters).map((s) => s.trim()).filter(Boolean);

  // Check each chunk to see if it has concatenated items without explicit conjunctions
  // e.g. "1kg rice 500g dal"
  const finalSegments: string[] = [];
  for (const chunk of rawChunks) {
    const subSegments = splitConcatenatedItems(chunk);
    finalSegments.push(...subSegments);
  }

  return finalSegments.filter((s) => s.trim().length > 0);
}

/**
 * Splits a chunk that lacks conjunctions but contains multiple quantity-item pairs
 * e.g., "1kg rice 500g dal" -> ["1kg rice", "500g dal"]
 */
function splitConcatenatedItems(chunk: string): string[] {
  const trimmed = chunk.trim();
  if (!trimmed) return [];

  // Regex matching start of quantity (e.g. "500g", "1.5 kg", "2 packet", "do kilo")
  const quantityStartRegex = /(?:^|\s+)(?:add\s+)?(\d+(?:\.\d+)?\s*(?:kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|packet|packets|pkt|pkts|pack|packs|pouch|pouches|litre|litres|liter|liters|ltr|ltrs|l|piece|pieces|pc|pcs|quintal|qtl)\b|(?:half a|half|quarter|aadha|adha|dedh|dhai|sawa|paune|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|chaar|paanch|chhe|che|saat|aath|nau|das)\s*(?:kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|packet|packets|pkt|pkts|pack|packs|pouch|pouches|litre|litres|liter|liters|ltr|ltrs|l|piece|pieces|pc|pcs|quintal|qtl)\b)/gi;

  const matches: { index: number; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = quantityStartRegex.exec(trimmed)) !== null) {
    const matchStr = match[0];
    const leadingWhitespace = matchStr.length - matchStr.trimStart().length;
    const actualIndex = match.index + leadingWhitespace;
    matches.push({ index: actualIndex, text: match[1] });
  }

  if (matches.length <= 1) {
    return [trimmed];
  }

  const segments: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : trimmed.length;
    const seg = trimmed.slice(startIndex, endIndex).trim();
    if (seg) {
      segments.push(seg);
    }
  }

  return segments.length > 0 ? segments : [trimmed];
}

/**
 * Parses a single item segment (e.g., "1kg rice", "500g dal", "2 packet salt at 25")
 */
function parseSingleSegment(segmentText: string, products: Product[]): ParsedVoiceItem | null {
  const trimmed = segmentText.trim();
  if (!trimmed) return null;

  let text = trimmed.toLowerCase();

  // Remove common conversational fillers and prefixes
  text = text.replace(/^(?:please|kripya|bhai|hello|hey nayab|nayab|ok|sunoji)\s+/i, '');
  text = text.replace(/^(?:add|plus|put|insert|daalo|jodo|ek|shamil karo|write)\s+/i, '');

  // Extract explicit rate if mentioned e.g. "at 45" or "rate 45" or "bhav 45" or "price 45" or "for 45"
  let explicitRate: number | undefined;
  const rateMatch = text.match(/(?:at|rate|bhav|price|for|ke hisab se|rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)/i);
  if (rateMatch) {
    explicitRate = parseFloat(rateMatch[1]);
    text = text.replace(rateMatch[0], '').trim();
  }

  let quantity: number = 1;
  let parsedUnit: UnitType | undefined;

  // Check for combined patterns like "2kg", "500g", "1.5litre", "2packet", "100gm"
  const comboMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|packet|packets|pkt|pkts|pack|packs|pouch|pouches|litre|litres|liter|liters|ltr|ltrs|l|piece|pieces|pc|pcs|quintal|qtl)\b/i);
  if (comboMatch) {
    quantity = parseFloat(comboMatch[1]);
    const rawUnit = comboMatch[2].toLowerCase();
    parsedUnit = UNIT_ALIASES[rawUnit] || (rawUnit as UnitType);
    text = text.replace(comboMatch[0], '').trim();
  } else {
    // Check for word numbers e.g. "two kg", "half kg", "do kilo", "aadha kilo", "500 gram"
    const wordComboMatch = text.match(/\b(half a|half|quarter|aadha|adha|dedh|dhai|sawa|paune|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|chaar|paanch|chhe|che|saat|aath|nau|das)\s*(kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|packet|packets|pkt|pkts|pack|packs|pouch|pouches|litre|litres|liter|liters|ltr|ltrs|l|piece|pieces|pc|pcs|quintal|qtl)?\b/i);
    if (wordComboMatch) {
      const word = wordComboMatch[1].toLowerCase();
      quantity = WORD_TO_NUMBER[word] ?? 1;
      if (wordComboMatch[2]) {
        const rawUnit = wordComboMatch[2].toLowerCase();
        parsedUnit = UNIT_ALIASES[rawUnit] || (rawUnit as UnitType);
      }
      text = text.replace(wordComboMatch[0], '').trim();
    } else {
      // Check for standalone numeric quantity e.g. "2 sugar" or "sugar 2"
      const numberMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
      if (numberMatch) {
        quantity = parseFloat(numberMatch[1]);
        text = text.replace(numberMatch[0], '').trim();
      }
    }
  }

  // Check for remaining unit word in case separated, e.g. "sugar in kg" or "sugar kg"
  if (!parsedUnit) {
    const standaloneUnitMatch = text.match(/\b(kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|packet|packets|pkt|pkts|pack|packs|pouch|pouches|litre|litres|liter|liters|ltr|ltrs|l|piece|pieces|pc|pcs|quintal|qtl)\b/i);
    if (standaloneUnitMatch) {
      const rawUnit = standaloneUnitMatch[1].toLowerCase();
      parsedUnit = UNIT_ALIASES[rawUnit] || (rawUnit as UnitType);
      text = text.replace(standaloneUnitMatch[0], '').trim();
    }
  }

  // Clean the item name query
  const query = text
    .replace(/^(?:of|ka|ki|ke|वाला|wali|wale)\s+/i, '')
    .replace(/\s+(?:do|please|bhai|chahiye|mangta|mangta hai|bhi|aur|tatha)$/i, '')
    .trim();

  const searchQuery = query || trimmed;
  if (!searchQuery) return null;

  // Match Query Against Products in Catalogue
  const matchedProduct = findBestProductMatch(searchQuery, products);

  if (matchedProduct) {
    let finalQuantity = quantity;
    let finalUnit: UnitType = parsedUnit || matchedProduct.unit;
    const finalRate = explicitRate !== undefined ? explicitRate : matchedProduct.rate;

    // Unit conversion between kg and g
    if (matchedProduct.unit === 'kg' && finalUnit === 'g') {
      finalQuantity = quantity / 1000;
      finalUnit = 'kg';
    } else if (matchedProduct.unit === 'g' && finalUnit === 'kg') {
      finalQuantity = quantity * 1000;
      finalUnit = 'g';
    } else if (!parsedUnit) {
      finalUnit = matchedProduct.unit;
    }

    const calculatedTotal = Math.round(finalQuantity * finalRate * 100) / 100;

    return {
      matchedProduct,
      name: matchedProduct.name,
      hindiName: matchedProduct.hindiName,
      quantity: finalQuantity,
      unit: finalUnit,
      rate: finalRate,
      total: calculatedTotal,
      confidence: 0.95,
      needsRate: false,
    };
  }

  // If no product matched in inventory: create loose/custom Kirana item
  const formattedName = searchQuery
    ? searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1)
    : 'Custom Item';

  const defaultUnit: UnitType = parsedUnit || 'piece';
  const defaultRate = explicitRate !== undefined ? explicitRate : 0;
  const calculatedTotal = Math.round(quantity * defaultRate * 100) / 100;

  return {
    name: formattedName,
    quantity,
    unit: defaultUnit,
    rate: defaultRate,
    total: calculatedTotal,
    needsRate: defaultRate === 0,
    confidence: 0.65,
  };
}

/**
 * Parses spoken text (e.g. "Add 1kg rice and 500g dal", "2kg sugar, 1 packet salt and 500g jeera")
 * into structured BillItems ready to be added to the active bill. Supports multiple items in a single utterance!
 */
export function parseVoiceCommand(transcript: string, products: Product[] = []): ParsedVoiceCommand {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return {
      rawTranscript: transcript,
      action: 'unknown',
      items: [],
      feedbackMessage: 'No speech detected. Please speak clearly.',
      success: false,
    };
  }

  // Split into distinct item segments (e.g. "Add 1kg rice and 500g dal" -> ["Add 1kg rice", "500g dal"])
  const segments = splitUtteranceIntoSegments(trimmed);

  if (segments.length === 0) {
    return {
      rawTranscript: transcript,
      action: 'unknown',
      items: [],
      feedbackMessage: 'Could not detect any items. Please speak clearly.',
      success: false,
    };
  }

  const parsedItems: ParsedVoiceItem[] = [];
  for (const seg of segments) {
    const item = parseSingleSegment(seg, products);
    if (item) {
      parsedItems.push(item);
    }
  }

  if (parsedItems.length === 0) {
    return {
      rawTranscript: transcript,
      action: 'unknown',
      items: [],
      feedbackMessage: 'Could not recognize items. Please try saying "Add 1kg rice and 500g dal".',
      success: false,
    };
  }

  let feedbackMessage = '';
  if (parsedItems.length === 1) {
    const single = parsedItems[0];
    const displayQty = single.unit === 'kg' && single.quantity < 1 && single.quantity > 0
      ? `${single.quantity * 1000}g (${single.quantity} kg)`
      : `${single.quantity} ${single.unit}`;

    feedbackMessage = single.needsRate
      ? `Recognized "${single.name}" (${displayQty}) - please confirm rate`
      : `Added ${displayQty} ${single.name} (₹${single.total.toFixed(2)})`;
  } else {
    const totalSum = parsedItems.reduce((sum, it) => sum + it.total, 0);
    const summaryList = parsedItems.map((it) => {
      const qStr = it.unit === 'kg' && it.quantity < 1 && it.quantity > 0
        ? `${it.quantity * 1000}g`
        : `${it.quantity} ${it.unit}`;
      return `${qStr} ${it.name}`;
    }).join(', ');

    const anyNeedsRate = parsedItems.some((it) => it.needsRate);
    feedbackMessage = anyNeedsRate
      ? `Recognized ${parsedItems.length} items (${summaryList}) - some need price confirmation`
      : `Added ${parsedItems.length} items (${summaryList}) • Total: ₹${totalSum.toFixed(2)}`;
  }

  return {
    rawTranscript: transcript,
    action: 'add_item',
    item: parsedItems[0],
    items: parsedItems,
    feedbackMessage,
    success: true,
  };
}

/**
 * Smart product matching algorithm with exact, token, alias and transliteration weights
 */
function findBestProductMatch(query: string, products: Product[]): Product | null {
  if (!query || products.length === 0) return null;
  const cleanQ = query.toLowerCase().trim();

  let bestProduct: Product | null = null;
  let highestScore = 0;

  for (const product of products) {
    let score = 0;
    const nameLower = product.name.toLowerCase();
    const hindiLower = product.hindiName?.toLowerCase() || '';

    // 1. Direct name equality or startsWith
    if (nameLower === cleanQ || hindiLower === cleanQ) {
      score = 100;
    } else if (nameLower.startsWith(cleanQ) || hindiLower.startsWith(cleanQ)) {
      score = 90;
    }

    // 2. Query matches alias mapping
    if (score < 85) {
      for (const [key, aliases] of Object.entries(KIRANA_ALIASES)) {
        if (product.name.includes(key) || key.includes(product.name)) {
          for (const alias of aliases) {
            if (cleanQ === alias) {
              score = Math.max(score, 95);
            } else if (cleanQ.includes(alias) || alias.includes(cleanQ)) {
              score = Math.max(score, 88);
            }
          }
        }
      }
    }

    // 3. Name contains query or query contains product words
    if (score < 80) {
      if (nameLower.includes(cleanQ) || (hindiLower && hindiLower.includes(cleanQ))) {
        score = Math.max(score, 80);
      }

      // Token overlap
      const queryTokens = cleanQ.split(/\s+/).filter((t) => t.length > 2);
      const nameTokens = nameLower.split(/[\s/()]+/).filter((t) => t.length > 2);

      let matchedTokens = 0;
      for (const qToken of queryTokens) {
        if (nameTokens.some((nToken) => nToken.includes(qToken) || qToken.includes(nToken))) {
          matchedTokens++;
        }
      }

      if (queryTokens.length > 0 && matchedTokens > 0) {
        const overlapRatio = matchedTokens / queryTokens.length;
        score = Math.max(score, Math.round(overlapRatio * 75));
      }
    }

    if (score > highestScore && score >= 50) {
      highestScore = score;
      bestProduct = product;
    }
  }

  return bestProduct;
}

