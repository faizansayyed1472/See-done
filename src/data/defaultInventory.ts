import { Product, ProductCategory } from '../types';

export const CATEGORY_LABELS: Record<ProductCategory, { label: string; hindi: string; color: string }> = {
  spices: { label: 'Spices & Masale', hindi: '', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  dal_pulses: { label: 'Dals & Pulses', hindi: '', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  grains_flour: { label: 'Flour & Rice', hindi: '', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  oil_ghee: { label: 'Oils & Ghee', hindi: '', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  dry_fruits: { label: 'Dry Fruits', hindi: '', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  packaged_grocery: { label: 'Packaged Grocery', hindi: '', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  daily_needs: { label: 'Daily Essentials', hindi: '', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  general: { label: 'General / Loose', hindi: '', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

export const INITIAL_PRODUCTS: Product[] = [
  // Spices & Masale
  { id: 'sp-1', name: 'Haldi Powder (Turmeric)', hindiName: 'हल्दी पाउडर', category: 'spices', unit: 'kg', rate: 260, stock: 45, popular: true, barcode: '8901058852011' },
  { id: 'sp-2', name: 'Jeera (Cumin Seeds)', hindiName: 'साबुत जीरा', category: 'spices', unit: 'kg', rate: 380, stock: 28, popular: true, barcode: '8901058852028' },
  { id: 'sp-3', name: 'Dhaniya Powder (Coriander)', hindiName: 'धनिया पाउडर', category: 'spices', unit: 'kg', rate: 220, stock: 35, popular: true, barcode: '8901058852035' },
  { id: 'sp-4', name: 'Lal Mirch Powder (Red Chilli)', hindiName: 'लाल मिर्च पाउडर', category: 'spices', unit: 'kg', rate: 340, stock: 18, popular: true, barcode: '8901058852042' },
  { id: 'sp-5', name: 'Garam Masala Special', hindiName: 'शाही गरम मसाला', category: 'spices', unit: 'kg', rate: 680, stock: 6, popular: true, barcode: '8901058852059' }, // Low stock!
  { id: 'sp-6', name: 'Chhoti Elaichi (Green Cardamom)', hindiName: 'छोटी इलायची', category: 'spices', unit: 'g', rate: 3.2, stock: 250, popular: true, barcode: '8901058852066' },
  { id: 'sp-7', name: 'Sabut Kali Mirch (Black Pepper)', hindiName: 'काली मिर्च', category: 'spices', unit: 'kg', rate: 850, stock: 14, popular: true, barcode: '8901058852073' },
  { id: 'sp-8', name: 'Laung (Cloves)', hindiName: 'साबुत लौंग', category: 'spices', unit: 'kg', rate: 1150, stock: 7, popular: false, barcode: '8901058852080' }, // Low stock!
  { id: 'sp-9', name: 'Dalchini (Cinnamon Bark)', hindiName: 'दालचीनी', category: 'spices', unit: 'kg', rate: 460, stock: 12, popular: false, barcode: '8901058852097' },
  { id: 'sp-10', name: 'Badi Elaichi (Black Cardamom)', hindiName: 'बड़ी इलायची', category: 'spices', unit: 'kg', rate: 1750, stock: 2, popular: false, barcode: '8901058852103' }, // Low stock!
  { id: 'sp-11', name: 'Rai / Sarson (Mustard Seeds)', hindiName: 'राई / सरसों दाना', category: 'spices', unit: 'kg', rate: 110, stock: 60, popular: true, barcode: '8901058852110' },
  { id: 'sp-12', name: 'Saunf (Fennel Seeds)', hindiName: 'सौंफ मोटी', category: 'spices', unit: 'kg', rate: 240, stock: 22, popular: false, barcode: '8901058852127' },
  { id: 'sp-13', name: 'Ajwain (Carom Seeds)', hindiName: 'अजवाइन', category: 'spices', unit: 'kg', rate: 290, stock: 16, popular: false, barcode: '8901058852134' },
  { id: 'sp-14', name: 'Kasuri Methi', hindiName: 'कस्तूरी मेथी', category: 'spices', unit: 'packet', rate: 45, stock: 25, popular: false, barcode: '8901058852141' },
  { id: 'sp-15', name: 'Asafoetida (Hing Vandevi 50g)', hindiName: 'हींग (50 ग्राम)', category: 'spices', unit: 'packet', rate: 115, stock: 4, popular: true, barcode: '8901058852158' }, // Low stock!
  { id: 'sp-16', name: 'Biryani Masala (Pack 100g)', hindiName: 'बिरयानी मसाला', category: 'spices', unit: 'packet', rate: 75, stock: 30, popular: true, barcode: '8901058852165' },
  { id: 'sp-17', name: 'Kashmiri Mirch (Deggi)', hindiName: 'कश्मीरी लाल मिर्च', category: 'spices', unit: 'kg', rate: 480, stock: 15, popular: true, barcode: '8901058852172' },
  { id: 'sp-18', name: 'Amchur Powder (Dry Mango)', hindiName: 'आमचूर पाउडर', category: 'spices', unit: 'kg', rate: 320, stock: 9, popular: false, barcode: '8901058852189' }, // Low stock!

  // Dals & Pulses
  { id: 'dal-1', name: 'Toor Dal (Arhar Dal)', hindiName: 'अरहर / तूर दाल', category: 'dal_pulses', unit: 'kg', rate: 165, stock: 85, popular: true, barcode: '8902058852018' },
  { id: 'dal-2', name: 'Moong Dal Dhuli (Yellow)', hindiName: 'मूंग दाल धुली', category: 'dal_pulses', unit: 'kg', rate: 130, stock: 40, popular: true, barcode: '8902058852025' },
  { id: 'dal-3', name: 'Chana Dal', hindiName: 'चना दाल', category: 'dal_pulses', unit: 'kg', rate: 92, stock: 55, popular: true, barcode: '8902058852032' },
  { id: 'dal-4', name: 'Urad Dal Dhuli (White)', hindiName: 'उड़द दाल धुली', category: 'dal_pulses', unit: 'kg', rate: 145, stock: 18, popular: false, barcode: '8902058852049' },
  { id: 'dal-5', name: 'Kabuli Chana (White Chickpeas)', hindiName: 'काबुली चना', category: 'dal_pulses', unit: 'kg', rate: 135, stock: 32, popular: true, barcode: '8902058852056' },
  { id: 'dal-6', name: 'Kala Chana (Desi Gram)', hindiName: 'काला चना', category: 'dal_pulses', unit: 'kg', rate: 85, stock: 24, popular: false, barcode: '8902058852063' },
  { id: 'dal-7', name: 'Rajma Chitra (Kidney Beans)', hindiName: 'चित्रा राजमा', category: 'dal_pulses', unit: 'kg', rate: 155, stock: 20, popular: true, barcode: '8902058852070' },

  // Grains & Flour
  { id: 'gr-1', name: 'Chakki Fresh Sharbati Atta', hindiName: 'शरबती गेहूं आटा', category: 'grains_flour', unit: 'kg', rate: 44, stock: 150, popular: true, barcode: '8903058852015' },
  { id: 'gr-2', name: 'Basmati Rice Daily Feast', hindiName: 'बासमती चावल', category: 'grains_flour', unit: 'kg', rate: 95, stock: 90, popular: true, barcode: '8903058852022' },
  { id: 'gr-3', name: 'Basmati Premium Royal 1121', hindiName: 'रॉयल 1121 बासमती', category: 'grains_flour', unit: 'kg', rate: 135, stock: 5, popular: false, barcode: '8903058852039' }, // Low stock!
  { id: 'gr-4', name: 'Maida (Refined Flour)', hindiName: 'मैदा', category: 'grains_flour', unit: 'kg', rate: 38, stock: 40, popular: false, barcode: '8903058852046' },
  { id: 'gr-5', name: 'Sooji / Rava (Semolina)', hindiName: 'सूजी / रवा', category: 'grains_flour', unit: 'kg', rate: 42, stock: 35, popular: false, barcode: '8903058852053' },
  { id: 'gr-6', name: 'Poha (Beaten Rice)', hindiName: 'पोहा मोटा', category: 'grains_flour', unit: 'kg', rate: 55, stock: 50, popular: true, barcode: '8903058852060' },

  // Oil & Ghee
  { id: 'oil-1', name: 'Sarson Ka Kachi Ghani Tel', hindiName: 'कच्ची घानी सरसों तेल', category: 'oil_ghee', unit: 'litre', rate: 158, stock: 65, popular: true, barcode: '8904058852012' },
  { id: 'oil-2', name: 'Refined Sunflower Oil 1L', hindiName: 'रिफाइंड तेल 1L', category: 'oil_ghee', unit: 'packet', rate: 138, stock: 45, popular: true, barcode: '8904058852029' },
  { id: 'oil-3', name: 'Shuddh Desi Cow Ghee', hindiName: 'शुद्ध देशी गाय घी', category: 'oil_ghee', unit: 'litre', rate: 640, stock: 8, popular: true, barcode: '8904058852036' }, // Low stock!

  // Dry Fruits
  { id: 'df-1', name: 'Kaju W320 (Cashews)', hindiName: 'काजू साबुत W320', category: 'dry_fruits', unit: 'kg', rate: 840, stock: 3, popular: true, barcode: '8905058852019' }, // Low stock!
  { id: 'df-2', name: 'Badam Giri (California Almonds)', hindiName: 'कैलिफोर्निया बादाम', category: 'dry_fruits', unit: 'kg', rate: 780, stock: 12, popular: true, barcode: '8905058852026' },
  { id: 'df-3', name: 'Kishmish (Green Raisins)', hindiName: 'हरी किशमिश', category: 'dry_fruits', unit: 'kg', rate: 340, stock: 15, popular: false, barcode: '8905058852033' },
  { id: 'df-4', name: 'Magaj / Tarbuj Beej (Melon seeds)', hindiName: 'मगज़ बीज', category: 'dry_fruits', unit: 'kg', rate: 650, stock: 7, popular: false, barcode: '8905058852040' }, // Low stock!

  // Daily Essentials & Groceries
  { id: 'de-1', name: 'Sugar / Cheeni M30', hindiName: 'सफेद चीनी', category: 'daily_needs', unit: 'kg', rate: 44, stock: 120, popular: true, barcode: '8906058852016' },
  { id: 'de-2', name: 'Tata Salt Iodized 1kg', hindiName: 'टाटा नमक 1kg', category: 'daily_needs', unit: 'packet', rate: 28, stock: 80, popular: true, barcode: '8901030382341' },
  { id: 'de-3', name: 'Saindhav Sendha Namak (Rock Salt)', hindiName: 'सेंधा नमक पिसा', category: 'daily_needs', unit: 'kg', rate: 45, stock: 22, popular: false, barcode: '8906058852030' },
  { id: 'de-4', name: 'Tea Gold Leaf Premium', hindiName: 'प्रीमियम चाय पत्ती', category: 'daily_needs', unit: 'kg', rate: 460, stock: 25, popular: true, barcode: '8906058852047' },
  { id: 'de-5', name: 'Jaggery / Gud Desi Bheli', hindiName: 'देसी गुड़ भेली', category: 'daily_needs', unit: 'kg', rate: 58, stock: 35, popular: false, barcode: '8906058852054' },
];
