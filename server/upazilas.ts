// GENERATED FILE - do not edit by hand.
//
// Source:    data/scraped/bd-scouts.ndjson
// Rows read: 141,379
// Pairs:     621 across 64 districts
// Generated: 2026-07-30 by scripts/generate-upazilas.ts
//
// `value` is byte-identical to the spelling stored on imported donor records,
// because that string is the join key for a district+upazila search. `label`
// is the English display name; for the entries the source register wrote in
// Bengali script it is a reviewed transliteration. `variants` lists every
// stored spelling that means this place, so a query can match all of them.
//
// This module must have no imports: it is loaded by the Express server, which
// runs from a production image that contains only `server/` and `dist/`, and
// it is re-exported into the browser bundle through src/lib/upazilas.ts.

export type Upazila = {
  value: string;
  label: string;
  variants: string[];
  donor_count: number;
};

export const UPAZILAS_BY_DISTRICT: Record<string, Upazila[]> = {
  "Bagerhat": [
    {"value":"Bagerhat Sadar","label":"Bagerhat Sadar","variants":["Bagerhat Sadar"],"donor_count":301},
    {"value":"Chitalmari","label":"Chitalmari","variants":["Chitalmari"],"donor_count":21},
    {"value":"Fakirhat","label":"Fakirhat","variants":["Fakirhat"],"donor_count":37},
    {"value":"Kachua","label":"Kachua","variants":["Kachua"],"donor_count":80},
    {"value":"Mollahat","label":"Mollahat","variants":["Mollahat"],"donor_count":19},
    {"value":"Mongla","label":"Mongla","variants":["Mongla"],"donor_count":582},
    {"value":"Morrelganj","label":"Morrelganj","variants":["Morrelganj"],"donor_count":178},
    {"value":"Rampal","label":"Rampal","variants":["Rampal"],"donor_count":133},
    {"value":"Sarankhola","label":"Sarankhola","variants":["Sarankhola"],"donor_count":123}
  ],
  "Bandarban": [
    {"value":"Alikadam","label":"Alikadam","variants":["Alikadam"],"donor_count":4},
    {"value":"Bandarban Sadar","label":"Bandarban Sadar","variants":["Bandarban Sadar"],"donor_count":206},
    {"value":"Lama","label":"Lama","variants":["Lama"],"donor_count":12},
    {"value":"Naikhongchhari","label":"Naikhongchhari","variants":["Naikhongchhari"],"donor_count":22},
    {"value":"Rowangchhari","label":"Rowangchhari","variants":["Rowangchhari"],"donor_count":6},
    {"value":"Ruma","label":"Ruma","variants":["Ruma"],"donor_count":9},
    {"value":"Thanchi","label":"Thanchi","variants":["Thanchi"],"donor_count":1}
  ],
  "Barguna": [
    {"value":"আমতলী","label":"Amtali","variants":["আমতলী"],"donor_count":52},
    {"value":"বামনা","label":"Bamna","variants":["বামনা"],"donor_count":11},
    {"value":"বরগুনা সদর","label":"Barguna Sadar","variants":["বরগুনা সদর"],"donor_count":270},
    {"value":"বেতাগি","label":"Betagi","variants":["বেতাগি"],"donor_count":35},
    {"value":"পাথরঘাটা","label":"Patharghata","variants":["পাথরঘাটা"],"donor_count":123},
    {"value":"তালতলী","label":"Taltali","variants":["তালতলী"],"donor_count":45}
  ],
  "Barishal": [
    {"value":"আগৈলঝাড়া","label":"Agailjhara","variants":["আগৈলঝাড়া"],"donor_count":29},
    {"value":"বাবুগঞ্জ","label":"Babuganj","variants":["বাবুগঞ্জ"],"donor_count":68},
    {"value":"বাকেরগঞ্জ","label":"Bakerganj","variants":["বাকেরগঞ্জ"],"donor_count":269},
    {"value":"বানারীপাড়া","label":"Banaripara","variants":["বানারীপাড়া"],"donor_count":48},
    {"value":"বন্দর","label":"Bandar","variants":["বন্দর"],"donor_count":4},
    {"value":"বরিশাল সদর","label":"Barishal Sadar","variants":["বরিশাল সদর"],"donor_count":659},
    {"value":"বিমান বন্দর","label":"Biman Bandar","variants":["বিমান বন্দর","Biman Bandar"],"donor_count":47},
    {"value":"গৌরনদী","label":"Gournadi","variants":["গৌরনদী"],"donor_count":174},
    {"value":"হিজলা","label":"Hizla","variants":["হিজলা"],"donor_count":71},
    {"value":"কাউনিয়া","label":"Kaunia","variants":["কাউনিয়া"],"donor_count":10},
    {"value":"কাজীর হাট","label":"Kazir Hat","variants":["কাজীর হাট"],"donor_count":3},
    {"value":"কতোয়ালী","label":"Kotwali","variants":["কতোয়ালী"],"donor_count":25},
    {"value":"মেহেন্দিগঞ্জ","label":"Mehendiganj","variants":["মেহেন্দিগঞ্জ"],"donor_count":53},
    {"value":"মুলাদী","label":"Muladi","variants":["মুলাদী"],"donor_count":68},
    {"value":"উজিরপুর","label":"Ujirpur","variants":["উজিরপুর"],"donor_count":90}
  ],
  "Bhola": [
    {"value":"ভোলা সদর","label":"Bhola Sadar","variants":["ভোলা সদর"],"donor_count":143},
    {"value":"বোরহানউদ্দিন","label":"Borhanuddin","variants":["বোরহানউদ্দিন"],"donor_count":86},
    {"value":"চরফ্যাশন","label":"Charfashion","variants":["চরফ্যাশন"],"donor_count":157},
    {"value":"Dakshinaicha","label":"Dakshinaicha","variants":["Dakshinaicha"],"donor_count":1},
    {"value":"দৌলতখান","label":"Daulatkhan","variants":["দৌলতখান"],"donor_count":48},
    {"value":"লালমোহন","label":"Lalmohan","variants":["লালমোহন"],"donor_count":59},
    {"value":"মনপুরা","label":"Monpura","variants":["মনপুরা"],"donor_count":23},
    {"value":"Shasibussion","label":"Shasibussion","variants":["Shasibussion"],"donor_count":3},
    {"value":"তজমুদ্দিন","label":"Tazumuddin","variants":["তজমুদ্দিন"],"donor_count":10}
  ],
  "Bogura": [
    {"value":"Adamdighi","label":"Adamdighi","variants":["Adamdighi"],"donor_count":189},
    {"value":"Bogura Sadar","label":"Bogura Sadar","variants":["Bogura Sadar"],"donor_count":797},
    {"value":"Dhunat","label":"Dhunat","variants":["Dhunat"],"donor_count":171},
    {"value":"Dhupchanchia","label":"Dhupchanchia","variants":["Dhupchanchia"],"donor_count":229},
    {"value":"Gabtali","label":"Gabtali","variants":["Gabtali"],"donor_count":261},
    {"value":"Kahaloo","label":"Kahaloo","variants":["Kahaloo"],"donor_count":283},
    {"value":"Majira","label":"Majira","variants":["Majira"],"donor_count":10},
    {"value":"Nandigram","label":"Nandigram","variants":["Nandigram"],"donor_count":139},
    {"value":"Sariakandi","label":"Sariakandi","variants":["Sariakandi"],"donor_count":256},
    {"value":"Shajahanpur","label":"Shajahanpur","variants":["Shajahanpur"],"donor_count":348},
    {"value":"Sherpur","label":"Sherpur","variants":["Sherpur"],"donor_count":199},
    {"value":"Shibganj","label":"Shibganj","variants":["Shibganj"],"donor_count":213},
    {"value":"Sonatala","label":"Sonatala","variants":["Sonatala"],"donor_count":332}
  ],
  "Brahmanbaria": [
    {"value":"Akhaura","label":"Akhaura","variants":["Akhaura"],"donor_count":292},
    {"value":"Ashuganj","label":"Ashuganj","variants":["Ashuganj"],"donor_count":114},
    {"value":"Banchharampur","label":"Banchharampur","variants":["Banchharampur"],"donor_count":150},
    {"value":"Bijoynagar","label":"Bijoynagar","variants":["Bijoynagar"],"donor_count":69},
    {"value":"Brahmanbaria Sadar","label":"Brahmanbaria Sadar","variants":["Brahmanbaria Sadar"],"donor_count":499},
    {"value":"Kasba","label":"Kasba","variants":["Kasba"],"donor_count":724},
    {"value":"Nabinagar","label":"Nabinagar","variants":["Nabinagar"],"donor_count":531},
    {"value":"Nasir Nagar","label":"Nasir Nagar","variants":["Nasir Nagar"],"donor_count":95},
    {"value":"Sarail","label":"Sarail","variants":["Sarail"],"donor_count":174}
  ],
  "Chandpur": [
    {"value":"Chandpur Sadar","label":"Chandpur Sadar","variants":["Chandpur Sadar"],"donor_count":669},
    {"value":"Dakshin Matlab","label":"Dakshin Matlab","variants":["Dakshin Matlab"],"donor_count":171},
    {"value":"Faridganj","label":"Faridganj","variants":["Faridganj"],"donor_count":328},
    {"value":"Haim Char","label":"Haim Char","variants":["Haim Char"],"donor_count":71},
    {"value":"Haziganj","label":"Haziganj","variants":["Haziganj"],"donor_count":339},
    {"value":"Kachua","label":"Kachua","variants":["Kachua"],"donor_count":435},
    {"value":"Shahrasti","label":"Shahrasti","variants":["Shahrasti"],"donor_count":201},
    {"value":"Uttar Matlab","label":"Uttar Matlab","variants":["Uttar Matlab"],"donor_count":206}
  ],
  "Chapainawabganj": [
    {"value":"Bholahat","label":"Bholahat","variants":["Bholahat"],"donor_count":389},
    {"value":"Chapainawabganj Sadar","label":"Chapainawabganj Sadar","variants":["Chapainawabganj Sadar"],"donor_count":830},
    {"value":"Gomastapur","label":"Gomastapur","variants":["Gomastapur"],"donor_count":896},
    {"value":"Nachole","label":"Nachole","variants":["Nachole"],"donor_count":253},
    {"value":"Shibganj","label":"Shibganj","variants":["Shibganj"],"donor_count":667}
  ],
  "Chattogram": [
    {"value":"Akbershah","label":"Akbershah","variants":["Akbershah"],"donor_count":43},
    {"value":"Anwara","label":"Anwara","variants":["Anwara"],"donor_count":82},
    {"value":"Baizid Bostami","label":"Baizid Bostami","variants":["Baizid Bostami"],"donor_count":99},
    {"value":"Bakoliya","label":"Bakoliya","variants":["Bakoliya"],"donor_count":96},
    {"value":"Bandar","label":"Bandar","variants":["Bandar"],"donor_count":187},
    {"value":"Banshkhali","label":"Banshkhali","variants":["Banshkhali"],"donor_count":396},
    {"value":"Bhujpur","label":"Bhujpur","variants":["Bhujpur"],"donor_count":15},
    {"value":"Boalkhali","label":"Boalkhali","variants":["Boalkhali"],"donor_count":514},
    {"value":"Chandanaish","label":"Chandanaish","variants":["Chandanaish"],"donor_count":54},
    {"value":"Chandgaon","label":"Chandgaon","variants":["Chandgaon"],"donor_count":174},
    {"value":"Chawkbazar","label":"Chawkbazar","variants":["Chawkbazar"],"donor_count":124},
    {"value":"Chittagong EPZ","label":"Chittagong EPZ","variants":["Chittagong EPZ"],"donor_count":218},
    {"value":"Chittagong PORT","label":"Chittagong PORT","variants":["Chittagong PORT"],"donor_count":41},
    {"value":"Chittagong Sadar","label":"Chittagong Sadar","variants":["Chittagong Sadar"],"donor_count":23},
    {"value":"Double Mooring","label":"Double Mooring","variants":["Double Mooring"],"donor_count":207},
    {"value":"Fatikchhari","label":"Fatikchhari","variants":["Fatikchhari"],"donor_count":385},
    {"value":"Halishahar","label":"Halishahar","variants":["Halishahar"],"donor_count":145},
    {"value":"Hathazari","label":"Hathazari","variants":["Hathazari"],"donor_count":367},
    {"value":"Jorargonj","label":"Jorargonj","variants":["Jorargonj"],"donor_count":29},
    {"value":"Karnafuli","label":"Karnafuli","variants":["Karnafuli"],"donor_count":48},
    {"value":"কর্ণফুলী","label":"Karnaphuli","variants":["কর্ণফুলী"],"donor_count":42},
    {"value":"Khulshi","label":"Khulshi","variants":["Khulshi"],"donor_count":115},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":172},
    {"value":"Lohagara","label":"Lohagara","variants":["Lohagara"],"donor_count":125},
    {"value":"Mirsharai","label":"Mirsharai","variants":["Mirsharai"],"donor_count":256},
    {"value":"Pahartali","label":"Pahartali","variants":["Pahartali"],"donor_count":96},
    {"value":"Panchlaish","label":"Panchlaish","variants":["Panchlaish"],"donor_count":134},
    {"value":"Patenga","label":"Patenga","variants":["Patenga"],"donor_count":105},
    {"value":"Patiya","label":"Patiya","variants":["Patiya"],"donor_count":406},
    {"value":"Rangunia","label":"Rangunia","variants":["Rangunia"],"donor_count":550},
    {"value":"Raozan","label":"Raozan","variants":["Raozan"],"donor_count":642},
    {"value":"Sadarghat","label":"Sadarghat","variants":["Sadarghat"],"donor_count":34},
    {"value":"Sandwip","label":"Sandwip","variants":["Sandwip"],"donor_count":33},
    {"value":"Satkania","label":"Satkania","variants":["Satkania"],"donor_count":167},
    {"value":"Sitakunda","label":"Sitakunda","variants":["Sitakunda"],"donor_count":129}
  ],
  "Chuadanga": [
    {"value":"Alamdanga","label":"Alamdanga","variants":["Alamdanga"],"donor_count":375},
    {"value":"Chuadanga Sadar","label":"Chuadanga Sadar","variants":["Chuadanga Sadar"],"donor_count":383},
    {"value":"Damurhuda","label":"Damurhuda","variants":["Damurhuda"],"donor_count":196},
    {"value":"Jiban Nagar","label":"Jiban Nagar","variants":["Jiban Nagar"],"donor_count":233}
  ],
  "Cox's Bazar": [
    {"value":"Chakaria","label":"Chakaria","variants":["Chakaria"],"donor_count":496},
    {"value":"Coxs Bazar Sadar","label":"Coxs Bazar Sadar","variants":["Coxs Bazar Sadar"],"donor_count":644},
    {"value":"ঈদগাঁও","label":"Eidgaon","variants":["ঈদগাঁও"],"donor_count":11},
    {"value":"Kutubdia","label":"Kutubdia","variants":["Kutubdia"],"donor_count":50},
    {"value":"Maheshkhali","label":"Maheshkhali","variants":["Maheshkhali"],"donor_count":28},
    {"value":"Pekua","label":"Pekua","variants":["Pekua"],"donor_count":163},
    {"value":"Ramu","label":"Ramu","variants":["Ramu"],"donor_count":129},
    {"value":"Teknaf","label":"Teknaf","variants":["Teknaf"],"donor_count":73},
    {"value":"Ukhia","label":"Ukhia","variants":["Ukhia"],"donor_count":109}
  ],
  "Cumilla": [
    {"value":"Barura","label":"Barura","variants":["Barura"],"donor_count":355},
    {"value":"Brahmanpara","label":"Brahmanpara","variants":["Brahmanpara"],"donor_count":164},
    {"value":"Burichong","label":"Burichong","variants":["Burichong"],"donor_count":135},
    {"value":"Chandina","label":"Chandina","variants":["Chandina"],"donor_count":316},
    {"value":"Chauddagram","label":"Chauddagram","variants":["Chauddagram"],"donor_count":419},
    {"value":"Comilla Adarsha Sadar","label":"Comilla Adarsha Sadar","variants":["Comilla Adarsha Sadar"],"donor_count":487},
    {"value":"Comilla Sadar Dakshin","label":"Comilla Sadar Dakshin","variants":["Comilla Sadar Dakshin"],"donor_count":366},
    {"value":"Daudkandi","label":"Daudkandi","variants":["Daudkandi"],"donor_count":137},
    {"value":"Debidwar","label":"Debidwar","variants":["Debidwar"],"donor_count":287},
    {"value":"Homna","label":"Homna","variants":["Homna"],"donor_count":137},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":13},
    {"value":"Laksam","label":"Laksam","variants":["Laksam"],"donor_count":413},
    {"value":"লালমাই","label":"Lalmai","variants":["লালমাই"],"donor_count":45},
    {"value":"Manoharganj","label":"Manoharganj","variants":["Manoharganj"],"donor_count":78},
    {"value":"Meghna","label":"Meghna","variants":["Meghna"],"donor_count":118},
    {"value":"Muradnagar","label":"Muradnagar","variants":["Muradnagar"],"donor_count":269},
    {"value":"Nangalkot","label":"Nangalkot","variants":["Nangalkot"],"donor_count":250},
    {"value":"Titas","label":"Titas","variants":["Titas"],"donor_count":167}
  ],
  "Dhaka": [
    {"value":"Adabor","label":"Adabor","variants":["Adabor"],"donor_count":129},
    {"value":"Ashulia","label":"Ashulia","variants":["Ashulia"],"donor_count":105},
    {"value":"Badda","label":"Badda","variants":["Badda"],"donor_count":263},
    {"value":"Banani","label":"Banani","variants":["Banani"],"donor_count":139},
    {"value":"Bangshal","label":"Bangshal","variants":["Bangshal"],"donor_count":157},
    {"value":"Cantonment","label":"Cantonment","variants":["Cantonment"],"donor_count":241},
    {"value":"Chackbazar Model","label":"Chawk Bazar","variants":["Chackbazar Model","Chalk Bazar"],"donor_count":116},
    {"value":"Dakshin Keraniganj","label":"Dakshin Keraniganj","variants":["Dakshin Keraniganj","South Keraniganj"],"donor_count":85},
    {"value":"Dakshin Khan","label":"Dakshin Khan","variants":["Dakshin Khan"],"donor_count":306},
    {"value":"Darus Salam","label":"Darus Salam","variants":["Darus Salam"],"donor_count":125},
    {"value":"Demra","label":"Demra","variants":["Demra"],"donor_count":721},
    {"value":"Dhaka Railway","label":"Dhaka Railway","variants":["Dhaka Railway"],"donor_count":17},
    {"value":"Dhamrai","label":"Dhamrai","variants":["Dhamrai"],"donor_count":266},
    {"value":"Dhanmondi","label":"Dhanmondi","variants":["Dhanmondi"],"donor_count":278},
    {"value":"Dohar","label":"Dohar","variants":["Dohar"],"donor_count":302},
    {"value":"Gandaria","label":"Gandaria","variants":["Gandaria"],"donor_count":125},
    {"value":"Gulshan","label":"Gulshan","variants":["Gulshan"],"donor_count":102},
    {"value":"Hazaribagh","label":"Hazaribagh","variants":["Hazaribagh"],"donor_count":144},
    {"value":"Jatrabari","label":"Jatrabari","variants":["Jatrabari"],"donor_count":739},
    {"value":"Kadomtoli","label":"Kadomtoli","variants":["Kadomtoli"],"donor_count":365},
    {"value":"Kafrul","label":"Kafrul","variants":["Kafrul"],"donor_count":359},
    {"value":"Kalabagan","label":"Kalabagan","variants":["Kalabagan"],"donor_count":95},
    {"value":"Kamrangirchar","label":"Kamrangirchar","variants":["Kamrangirchar"],"donor_count":109},
    {"value":"Keraniganj","label":"Keraniganj","variants":["Keraniganj"],"donor_count":576},
    {"value":"Khilgaon","label":"Khilgaon","variants":["Khilgaon"],"donor_count":576},
    {"value":"Khilkhet","label":"Khilkhet","variants":["Khilkhet"],"donor_count":93},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":95},
    {"value":"Lalbagh","label":"Lalbagh","variants":["Lalbagh"],"donor_count":398},
    {"value":"Mirpur","label":"Mirpur","variants":["Mirpur"],"donor_count":793},
    {"value":"Mohammadpur","label":"Mohammadpur","variants":["Mohammadpur"],"donor_count":536},
    {"value":"Motijheel","label":"Motijheel","variants":["Motijheel"],"donor_count":156},
    {"value":"Mugda","label":"Mugda","variants":["Mugda"],"donor_count":297},
    {"value":"Nawabganj","label":"Nawabganj","variants":["Nawabganj"],"donor_count":639},
    {"value":"New Market","label":"New Market","variants":["New Market"],"donor_count":194},
    {"value":"Pallabi","label":"Pallabi","variants":["Pallabi"],"donor_count":242},
    {"value":"Paltan","label":"Paltan","variants":["Paltan"],"donor_count":129},
    {"value":"Ramna","label":"Ramna","variants":["Ramna"],"donor_count":428},
    {"value":"Rampura","label":"Rampura","variants":["Rampura"],"donor_count":295},
    {"value":"Rupnagar","label":"Rupnagar","variants":["Rupnagar"],"donor_count":78},
    {"value":"Sabujbagh","label":"Sabujbagh","variants":["Sabujbagh"],"donor_count":413},
    {"value":"Savar","label":"Savar","variants":["Savar"],"donor_count":737},
    {"value":"Shah Ali","label":"Shah Ali","variants":["Shah Ali"],"donor_count":51},
    {"value":"Shahbagh","label":"Shahbagh","variants":["Shahbagh"],"donor_count":304},
    {"value":"Shahjahanpur","label":"Shahjahanpur","variants":["Shahjahanpur"],"donor_count":271},
    {"value":"Shahjalal Airport","label":"Shahjalal Airport","variants":["Shahjalal Airport"],"donor_count":18},
    {"value":"Sher-E-Bangla Nagar","label":"Sher-E-Bangla Nagar","variants":["Sher-E-Bangla Nagar"],"donor_count":242},
    {"value":"Shyampur","label":"Shyampur","variants":["Shyampur"],"donor_count":53},
    {"value":"Sutrapur","label":"Sutrapur","variants":["Sutrapur"],"donor_count":240},
    {"value":"Tejgaon","label":"Tejgaon","variants":["Tejgaon"],"donor_count":338},
    {"value":"Tejgaon Industrial Area","label":"Tejgaon Industrial Area","variants":["Tejgaon Industrial Area"],"donor_count":145},
    {"value":"Turag","label":"Turag","variants":["Turag"],"donor_count":71},
    {"value":"Uttar Khan","label":"Uttar Khan","variants":["Uttar Khan"],"donor_count":100},
    {"value":"Uttara","label":"Uttara","variants":["Uttara"],"donor_count":216},
    {"value":"Uttara East","label":"Uttara East","variants":["Uttara East"],"donor_count":119},
    {"value":"Uttara West","label":"Uttara West","variants":["Uttara West"],"donor_count":177},
    {"value":"Vashantek","label":"Vashantek","variants":["Vashantek"],"donor_count":123},
    {"value":"Vatara","label":"Vatara","variants":["Vatara"],"donor_count":86},
    {"value":"Wari","label":"Wari","variants":["Wari"],"donor_count":165}
  ],
  "Dinajpur": [
    {"value":"Biral","label":"Biral","variants":["Biral"],"donor_count":516},
    {"value":"Birampur","label":"Birampur","variants":["Birampur"],"donor_count":200},
    {"value":"Birganj","label":"Birganj","variants":["Birganj"],"donor_count":247},
    {"value":"Bochaganj","label":"Bochaganj","variants":["Bochaganj"],"donor_count":100},
    {"value":"Chirirbandar","label":"Chirirbandar","variants":["Chirirbandar"],"donor_count":322},
    {"value":"Dinajpur Sadar","label":"Dinajpur Sadar","variants":["Dinajpur Sadar"],"donor_count":714},
    {"value":"Ghoraghat","label":"Ghoraghat","variants":["Ghoraghat"],"donor_count":131},
    {"value":"Hakimpur","label":"Hakimpur","variants":["Hakimpur"],"donor_count":171},
    {"value":"Kaharole","label":"Kaharole","variants":["Kaharole"],"donor_count":190},
    {"value":"Khansama","label":"Khansama","variants":["Khansama"],"donor_count":206},
    {"value":"Nawabganj","label":"Nawabganj","variants":["Nawabganj"],"donor_count":174},
    {"value":"Parbatipur","label":"Parbatipur","variants":["Parbatipur"],"donor_count":314},
    {"value":"Phulbari","label":"Phulbari","variants":["Phulbari"],"donor_count":147}
  ],
  "Faridpur": [
    {"value":"Alfadanga","label":"Alfadanga","variants":["Alfadanga"],"donor_count":169},
    {"value":"Bhanga","label":"Bhanga","variants":["Bhanga"],"donor_count":208},
    {"value":"Boalmari","label":"Boalmari","variants":["Boalmari"],"donor_count":157},
    {"value":"Char Bhadrasan","label":"Char Bhadrasan","variants":["Char Bhadrasan"],"donor_count":78},
    {"value":"Faridpur Sadar","label":"Faridpur Sadar","variants":["Faridpur Sadar"],"donor_count":589},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":58},
    {"value":"Madhukhali","label":"Madhukhali","variants":["Madhukhali"],"donor_count":269},
    {"value":"Nagarkanda","label":"Nagarkanda","variants":["Nagarkanda"],"donor_count":168},
    {"value":"Sadarpur","label":"Sadarpur","variants":["Sadarpur"],"donor_count":259},
    {"value":"Saltha","label":"Saltha","variants":["Saltha"],"donor_count":53},
    {"value":"Sundarpur","label":"Sundarpur","variants":["Sundarpur"],"donor_count":2}
  ],
  "Feni": [
    {"value":"Chhagalnaiya","label":"Chhagalnaiya","variants":["Chhagalnaiya"],"donor_count":252},
    {"value":"Dagonbhuiyan","label":"Dagonbhuiyan","variants":["Dagonbhuiyan"],"donor_count":225},
    {"value":"Feni Sadar","label":"Feni Sadar","variants":["Feni Sadar"],"donor_count":833},
    {"value":"Fulgazi","label":"Fulgazi","variants":["Fulgazi"],"donor_count":113},
    {"value":"Parshuram","label":"Parshuram","variants":["Parshuram"],"donor_count":59},
    {"value":"Sonagazi","label":"Sonagazi","variants":["Sonagazi"],"donor_count":641}
  ],
  "Gaibandha": [
    {"value":"Fulchhari","label":"Fulchhari","variants":["Fulchhari"],"donor_count":29},
    {"value":"Gaibandha Sadar","label":"Gaibandha Sadar","variants":["Gaibandha Sadar"],"donor_count":371},
    {"value":"Gobindaganj","label":"Gobindaganj","variants":["Gobindaganj"],"donor_count":252},
    {"value":"Palashbari","label":"Palashbari","variants":["Palashbari"],"donor_count":73},
    {"value":"Sadullapur","label":"Sadullapur","variants":["Sadullapur"],"donor_count":60},
    {"value":"Saghata","label":"Saghata","variants":["Saghata"],"donor_count":205},
    {"value":"Sundarganj","label":"Sundarganj","variants":["Sundarganj"],"donor_count":43}
  ],
  "Gazipur": [
    {"value":"Gazipur Sadar","label":"Gazipur Sadar","variants":["Gazipur Sadar"],"donor_count":910},
    {"value":"Joydebpur","label":"Joydebpur","variants":["Joydebpur"],"donor_count":72},
    {"value":"Kaliakair","label":"Kaliakair","variants":["Kaliakair"],"donor_count":951},
    {"value":"Kaliganj","label":"Kaliganj","variants":["Kaliganj"],"donor_count":349},
    {"value":"Kapasia","label":"Kapasia","variants":["Kapasia"],"donor_count":526},
    {"value":"Sreepur","label":"Sreepur","variants":["Sreepur"],"donor_count":405},
    {"value":"Tongi","label":"Tongi","variants":["Tongi"],"donor_count":236}
  ],
  "Gopalganj": [
    {"value":"Gopalganj Sadar","label":"Gopalganj Sadar","variants":["Gopalganj Sadar"],"donor_count":791},
    {"value":"Kashiani","label":"Kashiani","variants":["Kashiani"],"donor_count":145},
    {"value":"Kotalipara","label":"Kotalipara","variants":["Kotalipara"],"donor_count":392},
    {"value":"Muksudpur","label":"Muksudpur","variants":["Muksudpur"],"donor_count":286},
    {"value":"Tungipara","label":"Tungipara","variants":["Tungipara"],"donor_count":83}
  ],
  "Habiganj": [
    {"value":"Ajmiriganj","label":"Ajmiriganj","variants":["Ajmiriganj"],"donor_count":31},
    {"value":"Bahubal","label":"Bahubal","variants":["Bahubal"],"donor_count":131},
    {"value":"Baniyachong","label":"Baniyachong","variants":["Baniyachong"],"donor_count":295},
    {"value":"Chunarughat","label":"Chunarughat","variants":["Chunarughat"],"donor_count":312},
    {"value":"Habiganj Sadar","label":"Habiganj Sadar","variants":["Habiganj Sadar"],"donor_count":374},
    {"value":"Lakhai","label":"Lakhai","variants":["Lakhai"],"donor_count":98},
    {"value":"Madhabpur","label":"Madhabpur","variants":["Madhabpur"],"donor_count":233},
    {"value":"Nabiganj","label":"Nabiganj","variants":["Nabiganj"],"donor_count":88},
    {"value":"Shayestaganj","label":"Shayestaganj","variants":["Shayestaganj"],"donor_count":70}
  ],
  "Jamalpur": [
    {"value":"Baksiganj","label":"Baksiganj","variants":["Baksiganj"],"donor_count":25},
    {"value":"Dewanganj","label":"Dewanganj","variants":["Dewanganj"],"donor_count":27},
    {"value":"Islampur","label":"Islampur","variants":["Islampur"],"donor_count":67},
    {"value":"Jamalpur Sadar","label":"Jamalpur Sadar","variants":["Jamalpur Sadar"],"donor_count":304},
    {"value":"Madarganj","label":"Madarganj","variants":["Madarganj"],"donor_count":139},
    {"value":"Melandaha","label":"Melandaha","variants":["Melandaha"],"donor_count":199},
    {"value":"Sarishabari","label":"Sarishabari","variants":["Sarishabari"],"donor_count":265}
  ],
  "Jashore": [
    {"value":"Abhaynagar","label":"Abhaynagar","variants":["Abhaynagar"],"donor_count":409},
    {"value":"Bagerpara","label":"Bagerpara","variants":["Bagerpara"],"donor_count":45},
    {"value":"Benapole PORT","label":"Benapole Port","variants":["Benapole PORT","Benapole"],"donor_count":12},
    {"value":"Chaugachha","label":"Chaugachha","variants":["Chaugachha"],"donor_count":79},
    {"value":"Jhikargachha","label":"Jhikargachha","variants":["Jhikargachha"],"donor_count":110},
    {"value":"Keshabpur","label":"Keshabpur","variants":["Keshabpur"],"donor_count":13},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":408},
    {"value":"Manirampur","label":"Manirampur","variants":["Manirampur"],"donor_count":101},
    {"value":"Sharsha","label":"Sharsha","variants":["Sharsha"],"donor_count":41}
  ],
  "Jhalokati": [
    {"value":"ঝালকাঠি সদর","label":"Jhalokati Sadar","variants":["ঝালকাঠি সদর"],"donor_count":221},
    {"value":"কাঁঠালিয়া","label":"Kathalia","variants":["কাঁঠালিয়া"],"donor_count":67},
    {"value":"নলছিটি","label":"Nalchity","variants":["নলছিটি"],"donor_count":61},
    {"value":"রাজাপুর","label":"Rajapur","variants":["রাজাপুর"],"donor_count":31}
  ],
  "Jhenaidah": [
    {"value":"Harinakunda","label":"Harinakunda","variants":["Harinakunda"],"donor_count":232},
    {"value":"Jhenaidah Sadar","label":"Jhenaidah Sadar","variants":["Jhenaidah Sadar"],"donor_count":591},
    {"value":"Kaliganj","label":"Kaliganj","variants":["Kaliganj"],"donor_count":194},
    {"value":"Kotchandpur","label":"Kotchandpur","variants":["Kotchandpur"],"donor_count":318},
    {"value":"Maheshpur","label":"Maheshpur","variants":["Maheshpur"],"donor_count":48},
    {"value":"Shailkupa","label":"Shailkupa","variants":["Shailkupa"],"donor_count":131}
  ],
  "Joypurhat": [
    {"value":"Akkelpur","label":"Akkelpur","variants":["Akkelpur"],"donor_count":375},
    {"value":"Joypurhat Sadar","label":"Joypurhat Sadar","variants":["Joypurhat Sadar"],"donor_count":791},
    {"value":"Kalai","label":"Kalai","variants":["Kalai"],"donor_count":201},
    {"value":"Khetlal","label":"Khetlal","variants":["Khetlal"],"donor_count":142},
    {"value":"Panchbibi","label":"Panchbibi","variants":["Panchbibi"],"donor_count":829}
  ],
  "Khagrachhari": [
    {"value":"Dighinala","label":"Dighinala","variants":["Dighinala"],"donor_count":113},
    {"value":"Guimara","label":"Guimara","variants":["Guimara"],"donor_count":47},
    {"value":"Khagrachhari Sadar","label":"Khagrachhari Sadar","variants":["Khagrachhari Sadar"],"donor_count":471},
    {"value":"Lakshmichhari","label":"Lakshmichhari","variants":["Lakshmichhari"],"donor_count":10},
    {"value":"Mahalchhari","label":"Mahalchhari","variants":["Mahalchhari"],"donor_count":81},
    {"value":"Manikchhari","label":"Manikchhari","variants":["Manikchhari"],"donor_count":100},
    {"value":"Matiranga","label":"Matiranga","variants":["Matiranga"],"donor_count":149},
    {"value":"Panchhari","label":"Panchhari","variants":["Panchhari"],"donor_count":36},
    {"value":"Ramgarh","label":"Ramgarh","variants":["Ramgarh"],"donor_count":136}
  ],
  "Khulna": [
    {"value":"Aronghata","label":"Aronghata","variants":["Aronghata"],"donor_count":2},
    {"value":"Batiaghata","label":"Batiaghata","variants":["Batiaghata"],"donor_count":87},
    {"value":"Dacope","label":"Dacope","variants":["Dacope"],"donor_count":64},
    {"value":"Daulatpur","label":"Daulatpur","variants":["Daulatpur"],"donor_count":114},
    {"value":"Dighalia","label":"Dighalia","variants":["Dighalia"],"donor_count":159},
    {"value":"Dumuria","label":"Dumuria","variants":["Dumuria"],"donor_count":41},
    {"value":"Harintana","label":"Harintana","variants":["Harintana"],"donor_count":5},
    {"value":"Khalishpur","label":"Khalishpur","variants":["Khalishpur"],"donor_count":269},
    {"value":"Khan Jahan Ali","label":"Khan Jahan Ali","variants":["Khan Jahan Ali"],"donor_count":53},
    {"value":"Khulna Sadar","label":"Khulna Sadar","variants":["Khulna Sadar"],"donor_count":305},
    {"value":"Koyra","label":"Koyra","variants":["Koyra"],"donor_count":110},
    {"value":"Labanchora","label":"Labanchora","variants":["Labanchora"],"donor_count":16},
    {"value":"Paikgachha","label":"Paikgachha","variants":["Paikgachha"],"donor_count":208},
    {"value":"Phultala","label":"Phultala","variants":["Phultala"],"donor_count":35},
    {"value":"Rupsa","label":"Rupsa","variants":["Rupsa"],"donor_count":100},
    {"value":"Sonadanga","label":"Sonadanga","variants":["Sonadanga"],"donor_count":171},
    {"value":"Terokhada","label":"Terokhada","variants":["Terokhada"],"donor_count":55}
  ],
  "Kishoreganj": [
    {"value":"Austagram","label":"Austagram","variants":["Austagram"],"donor_count":124},
    {"value":"Bajitpur","label":"Bajitpur","variants":["Bajitpur"],"donor_count":223},
    {"value":"Bhairab","label":"Bhairab","variants":["Bhairab"],"donor_count":187},
    {"value":"Hossainpur","label":"Hossainpur","variants":["Hossainpur"],"donor_count":148},
    {"value":"Itna","label":"Itna","variants":["Itna"],"donor_count":24},
    {"value":"Karimganj","label":"Karimganj","variants":["Karimganj"],"donor_count":261},
    {"value":"Katiadi","label":"Katiadi","variants":["Katiadi"],"donor_count":99},
    {"value":"Kishoreganj Sadar","label":"Kishoreganj Sadar","variants":["Kishoreganj Sadar"],"donor_count":480},
    {"value":"Kuliarchar","label":"Kuliarchar","variants":["Kuliarchar"],"donor_count":193},
    {"value":"Mithamain","label":"Mithamain","variants":["Mithamain"],"donor_count":77},
    {"value":"Nikli","label":"Nikli","variants":["Nikli"],"donor_count":13},
    {"value":"Pakundia","label":"Pakundia","variants":["Pakundia"],"donor_count":227},
    {"value":"Tarail","label":"Tarail","variants":["Tarail"],"donor_count":38}
  ],
  "Kurigram": [
    {"value":"Bhurungamari","label":"Bhurungamari","variants":["Bhurungamari"],"donor_count":627},
    {"value":"Char Rajibpur","label":"Char Rajibpur","variants":["Char Rajibpur"],"donor_count":105},
    {"value":"Chilmari","label":"Chilmari","variants":["Chilmari"],"donor_count":499},
    {"value":"Dusmara","label":"Dusmara","variants":["Dusmara"],"donor_count":2},
    {"value":"Kachakata","label":"Kachakata","variants":["Kachakata"],"donor_count":14},
    {"value":"Kurigram Sadar","label":"Kurigram Sadar","variants":["Kurigram Sadar"],"donor_count":1364},
    {"value":"Nageshwari","label":"Nageshwari","variants":["Nageshwari"],"donor_count":743},
    {"value":"Phulbari","label":"Phulbari","variants":["Phulbari"],"donor_count":1310},
    {"value":"Rajarhat","label":"Rajarhat","variants":["Rajarhat"],"donor_count":1425},
    {"value":"Rowmari","label":"Rowmari","variants":["Rowmari"],"donor_count":580},
    {"value":"Ulipur","label":"Ulipur","variants":["Ulipur"],"donor_count":2042}
  ],
  "Kushtia": [
    {"value":"Bheramara","label":"Bheramara","variants":["Bheramara"],"donor_count":142},
    {"value":"Daulatpur","label":"Daulatpur","variants":["Daulatpur"],"donor_count":253},
    {"value":"Khoksa","label":"Khoksa","variants":["Khoksa"],"donor_count":62},
    {"value":"Kumarkhali","label":"Kumarkhali","variants":["Kumarkhali"],"donor_count":152},
    {"value":"Kushtia Sadar","label":"Kushtia Sadar","variants":["Kushtia Sadar"],"donor_count":494},
    {"value":"Mirpur","label":"Mirpur","variants":["Mirpur"],"donor_count":159}
  ],
  "Lakshmipur": [
    {"value":"Kamalnagar","label":"Kamalnagar","variants":["Kamalnagar"],"donor_count":91},
    {"value":"Lakshmipur Sadar","label":"Lakshmipur Sadar","variants":["Lakshmipur Sadar"],"donor_count":522},
    {"value":"Raipur","label":"Raipur","variants":["Raipur"],"donor_count":163},
    {"value":"Ramganj","label":"Ramganj","variants":["Ramganj"],"donor_count":298},
    {"value":"Ramgati","label":"Ramgati","variants":["Ramgati"],"donor_count":315}
  ],
  "Lalmonirhat": [
    {"value":"Aditmari","label":"Aditmari","variants":["Aditmari"],"donor_count":839},
    {"value":"Hatibandha","label":"Hatibandha","variants":["Hatibandha"],"donor_count":270},
    {"value":"Kaliganj","label":"Kaliganj","variants":["Kaliganj"],"donor_count":393},
    {"value":"Lalmonirhat Sadar","label":"Lalmonirhat Sadar","variants":["Lalmonirhat Sadar"],"donor_count":1178},
    {"value":"Patgram","label":"Patgram","variants":["Patgram"],"donor_count":171}
  ],
  "Madaripur": [
    {"value":"Kalkini","label":"Kalkini","variants":["Kalkini"],"donor_count":325},
    {"value":"Madaripur Sadar","label":"Madaripur Sadar","variants":["Madaripur Sadar"],"donor_count":173},
    {"value":"Rajoir","label":"Rajoir","variants":["Rajoir"],"donor_count":73},
    {"value":"Shibchar","label":"Shibchar","variants":["Shibchar"],"donor_count":172}
  ],
  "Magura": [
    {"value":"Magura Sadar","label":"Magura Sadar","variants":["Magura Sadar"],"donor_count":476},
    {"value":"Mohammadpur","label":"Mohammadpur","variants":["Mohammadpur"],"donor_count":23},
    {"value":"Shalikha","label":"Shalikha","variants":["Shalikha"],"donor_count":76},
    {"value":"Sreepur","label":"Sreepur","variants":["Sreepur"],"donor_count":98}
  ],
  "Manikganj": [
    {"value":"Daulatpur","label":"Daulatpur","variants":["Daulatpur"],"donor_count":219},
    {"value":"Ghior","label":"Ghior","variants":["Ghior"],"donor_count":267},
    {"value":"Harirampur","label":"Harirampur","variants":["Harirampur"],"donor_count":161},
    {"value":"Manikganj Sadar","label":"Manikganj Sadar","variants":["Manikganj Sadar"],"donor_count":499},
    {"value":"Saturia","label":"Saturia","variants":["Saturia"],"donor_count":388},
    {"value":"Shibalaya","label":"Shibalaya","variants":["Shibalaya"],"donor_count":638},
    {"value":"Singair","label":"Singair","variants":["Singair"],"donor_count":499}
  ],
  "Meherpur": [
    {"value":"Gangni","label":"Gangni","variants":["Gangni"],"donor_count":60},
    {"value":"Meherpur Sadar","label":"Meherpur Sadar","variants":["Meherpur Sadar"],"donor_count":233},
    {"value":"Mujibnagar","label":"Mujibnagar","variants":["Mujibnagar"],"donor_count":57}
  ],
  "Moulvibazar": [
    {"value":"Barlekha","label":"Barlekha","variants":["Barlekha"],"donor_count":275},
    {"value":"Juri","label":"Juri","variants":["Juri"],"donor_count":214},
    {"value":"Kamalganj","label":"Kamalganj","variants":["Kamalganj"],"donor_count":277},
    {"value":"Kulaura","label":"Kulaura","variants":["Kulaura"],"donor_count":416},
    {"value":"Moulvibazar Sadar","label":"Moulvibazar Sadar","variants":["Moulvibazar Sadar"],"donor_count":422},
    {"value":"Rajnagar","label":"Rajnagar","variants":["Rajnagar"],"donor_count":184},
    {"value":"Sreemangal","label":"Sreemangal","variants":["Sreemangal"],"donor_count":189}
  ],
  "Munshiganj": [
    {"value":"Gazaria","label":"Gazaria","variants":["Gazaria"],"donor_count":118},
    {"value":"Louhajong","label":"Louhajong","variants":["Louhajong"],"donor_count":77},
    {"value":"Munshiganj Sadar","label":"Munshiganj Sadar","variants":["Munshiganj Sadar"],"donor_count":277},
    {"value":"Sirajdikhan","label":"Sirajdikhan","variants":["Sirajdikhan"],"donor_count":164},
    {"value":"Sreenagar","label":"Sreenagar","variants":["Sreenagar"],"donor_count":158},
    {"value":"Tongibari","label":"Tongibari","variants":["Tongibari"],"donor_count":151}
  ],
  "Mymensingh": [
    {"value":"Bhaluka","label":"Bhaluka","variants":["Bhaluka"],"donor_count":252},
    {"value":"Dhobaura","label":"Dhobaura","variants":["Dhobaura"],"donor_count":42},
    {"value":"Fulbaria","label":"Fulbaria","variants":["Fulbaria"],"donor_count":269},
    {"value":"Gaffargaon","label":"Gaffargaon","variants":["Gaffargaon"],"donor_count":47},
    {"value":"Gouripur","label":"Gouripur","variants":["Gouripur"],"donor_count":220},
    {"value":"Haluaghat","label":"Haluaghat","variants":["Haluaghat"],"donor_count":121},
    {"value":"Ishwarganj","label":"Ishwarganj","variants":["Ishwarganj"],"donor_count":38},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":29},
    {"value":"Muktagachha","label":"Muktagachha","variants":["Muktagachha"],"donor_count":235},
    {"value":"Mymensingh Sadar","label":"Mymensingh Sadar","variants":["Mymensingh Sadar"],"donor_count":752},
    {"value":"Nandail","label":"Nandail","variants":["Nandail"],"donor_count":54},
    {"value":"Phulpur","label":"Phulpur","variants":["Phulpur"],"donor_count":135},
    {"value":"Tarakanda","label":"Tarakanda","variants":["Tarakanda"],"donor_count":83},
    {"value":"Trishal","label":"Trishal","variants":["Trishal"],"donor_count":124}
  ],
  "Naogaon": [
    {"value":"Atrai","label":"Atrai","variants":["Atrai"],"donor_count":266},
    {"value":"Badalgachhi","label":"Badalgachhi","variants":["Badalgachhi"],"donor_count":150},
    {"value":"Dhamoirhat","label":"Dhamoirhat","variants":["Dhamoirhat"],"donor_count":45},
    {"value":"Manda","label":"Manda","variants":["Manda"],"donor_count":269},
    {"value":"Mohadevpur","label":"Mohadevpur","variants":["Mohadevpur"],"donor_count":165},
    {"value":"Naogaon Sadar","label":"Naogaon Sadar","variants":["Naogaon Sadar"],"donor_count":471},
    {"value":"Niamatpur","label":"Niamatpur","variants":["Niamatpur"],"donor_count":262},
    {"value":"Patnitala","label":"Patnitala","variants":["Patnitala"],"donor_count":213},
    {"value":"Porsha","label":"Porsha","variants":["Porsha"],"donor_count":24},
    {"value":"Raninagar","label":"Raninagar","variants":["Raninagar"],"donor_count":81},
    {"value":"Sapahar","label":"Sapahar","variants":["Sapahar"],"donor_count":148}
  ],
  "Narail": [
    {"value":"Kalia","label":"Kalia","variants":["Kalia"],"donor_count":38},
    {"value":"Lohagara","label":"Lohagara","variants":["Lohagara"],"donor_count":143},
    {"value":"Naragathi","label":"Naragathi","variants":["Naragathi"],"donor_count":3},
    {"value":"Narail Sadar","label":"Narail Sadar","variants":["Narail Sadar"],"donor_count":170}
  ],
  "Narayanganj": [
    {"value":"Araihazar","label":"Araihazar","variants":["Araihazar"],"donor_count":257},
    {"value":"Bandar","label":"Bandar","variants":["Bandar"],"donor_count":231},
    {"value":"Fatullah","label":"Fatullah","variants":["Fatullah"],"donor_count":215},
    {"value":"Narayanganj Sadar","label":"Narayanganj Sadar","variants":["Narayanganj Sadar"],"donor_count":587},
    {"value":"Rupganj","label":"Rupganj","variants":["Rupganj"],"donor_count":199},
    {"value":"Siddhirganj","label":"Siddhirganj","variants":["Siddhirganj"],"donor_count":167},
    {"value":"Sonargaon","label":"Sonargaon","variants":["Sonargaon"],"donor_count":380}
  ],
  "Narsingdi": [
    {"value":"Belabo","label":"Belabo","variants":["Belabo"],"donor_count":197},
    {"value":"Monohardi","label":"Monohardi","variants":["Monohardi"],"donor_count":166},
    {"value":"Narsingdi Sadar","label":"Narsingdi Sadar","variants":["Narsingdi Sadar"],"donor_count":520},
    {"value":"Palash","label":"Palash","variants":["Palash"],"donor_count":285},
    {"value":"Raipura","label":"Raipura","variants":["Raipura"],"donor_count":287},
    {"value":"Shibpur","label":"Shibpur","variants":["Shibpur"],"donor_count":272}
  ],
  "Natore": [
    {"value":"Bagatipara","label":"Bagatipara","variants":["Bagatipara"],"donor_count":254},
    {"value":"Boraigram","label":"Boraigram","variants":["Boraigram"],"donor_count":227},
    {"value":"Gurudaspur","label":"Gurudaspur","variants":["Gurudaspur"],"donor_count":308},
    {"value":"Lalpur","label":"Lalpur","variants":["Lalpur"],"donor_count":390},
    {"value":"Natore Sadar","label":"Natore Sadar","variants":["Natore Sadar"],"donor_count":686},
    {"value":"Noldanga","label":"Noldanga","variants":["Noldanga"],"donor_count":317},
    {"value":"Singra","label":"Singra","variants":["Singra"],"donor_count":593}
  ],
  "Netrokona": [
    {"value":"Atpara","label":"Atpara","variants":["Atpara"],"donor_count":42},
    {"value":"Barhatta","label":"Barhatta","variants":["Barhatta"],"donor_count":20},
    {"value":"Durgapur","label":"Durgapur","variants":["Durgapur"],"donor_count":14},
    {"value":"Kalmakanda","label":"Kalmakanda","variants":["Kalmakanda"],"donor_count":15},
    {"value":"Kendua","label":"Kendua","variants":["Kendua"],"donor_count":106},
    {"value":"Khaliajuri","label":"Khaliajuri","variants":["Khaliajuri"],"donor_count":9},
    {"value":"Madan","label":"Madan","variants":["Madan"],"donor_count":121},
    {"value":"Mohanganj","label":"Mohanganj","variants":["Mohanganj"],"donor_count":14},
    {"value":"Netrokona Sadar","label":"Netrokona Sadar","variants":["Netrokona Sadar"],"donor_count":301},
    {"value":"Purbadhala","label":"Purbadhala","variants":["Purbadhala"],"donor_count":178}
  ],
  "Nilphamari": [
    {"value":"Dimla","label":"Dimla","variants":["Dimla"],"donor_count":385},
    {"value":"Domar","label":"Domar","variants":["Domar"],"donor_count":145},
    {"value":"Jaldhaka","label":"Jaldhaka","variants":["Jaldhaka"],"donor_count":207},
    {"value":"Kishoreganj","label":"Kishoreganj","variants":["Kishoreganj"],"donor_count":25},
    {"value":"Nilphamari Sadar","label":"Nilphamari Sadar","variants":["Nilphamari Sadar"],"donor_count":501},
    {"value":"Saidpur","label":"Saidpur","variants":["Saidpur"],"donor_count":465}
  ],
  "Noakhali": [
    {"value":"Begumganj","label":"Begumganj","variants":["Begumganj"],"donor_count":299},
    {"value":"Char Jabber","label":"Char Jabber","variants":["Char Jabber"],"donor_count":5},
    {"value":"Chatkhil","label":"Chatkhil","variants":["Chatkhil"],"donor_count":256},
    {"value":"Companiganj","label":"Companiganj","variants":["Companiganj"],"donor_count":153},
    {"value":"Hatiya","label":"Hatiya","variants":["Hatiya"],"donor_count":67},
    {"value":"Kabirhat","label":"Kabirhat","variants":["Kabirhat"],"donor_count":129},
    {"value":"Noakhali Sadar","label":"Noakhali Sadar","variants":["Noakhali Sadar"],"donor_count":517},
    {"value":"Senbagh","label":"Senbagh","variants":["Senbagh"],"donor_count":401},
    {"value":"Sonaimuri","label":"Sonaimuri","variants":["Sonaimuri"],"donor_count":209},
    {"value":"Subarnachar","label":"Subarnachar","variants":["Subarnachar"],"donor_count":529},
    {"value":"Sudharam","label":"Sudharam","variants":["Sudharam"],"donor_count":17}
  ],
  "Pabna": [
    {"value":"Aminpur","label":"Aminpur","variants":["Aminpur"],"donor_count":22},
    {"value":"Ataikula","label":"Ataikula","variants":["Ataikula"],"donor_count":18},
    {"value":"Atgharia","label":"Atgharia","variants":["Atgharia"],"donor_count":53},
    {"value":"Bangura","label":"Bangura","variants":["Bangura"],"donor_count":21},
    {"value":"Bera","label":"Bera","variants":["Bera"],"donor_count":135},
    {"value":"Bhangura","label":"Bhangura","variants":["Bhangura"],"donor_count":69},
    {"value":"Chatmohar","label":"Chatmohar","variants":["Chatmohar"],"donor_count":203},
    {"value":"Faridpur","label":"Faridpur","variants":["Faridpur"],"donor_count":59},
    {"value":"Ishwardi","label":"Ishwardi","variants":["Ishwardi"],"donor_count":257},
    {"value":"Pabna Sadar","label":"Pabna Sadar","variants":["Pabna Sadar"],"donor_count":604},
    {"value":"Santhia","label":"Santhia","variants":["Santhia"],"donor_count":119},
    {"value":"Sujanagar","label":"Sujanagar","variants":["Sujanagar"],"donor_count":271}
  ],
  "Panchagarh": [
    {"value":"Atwari","label":"Atwari","variants":["Atwari"],"donor_count":501},
    {"value":"Boda","label":"Boda","variants":["Boda"],"donor_count":300},
    {"value":"Debiganj","label":"Debiganj","variants":["Debiganj"],"donor_count":780},
    {"value":"Panchagarh Sadar","label":"Panchagarh Sadar","variants":["Panchagarh Sadar"],"donor_count":550},
    {"value":"Tetulia","label":"Tetulia","variants":["Tetulia"],"donor_count":453}
  ],
  "Patuakhali": [
    {"value":"Bauphal","label":"Bauphal","variants":["Bauphal"],"donor_count":119},
    {"value":"Dashmina","label":"Dashmina","variants":["Dashmina"],"donor_count":45},
    {"value":"Dumki","label":"Dumki","variants":["Dumki"],"donor_count":147},
    {"value":"Galachipa","label":"Galachipa","variants":["Galachipa"],"donor_count":39},
    {"value":"Kalapara","label":"Kalapara","variants":["Kalapara"],"donor_count":84},
    {"value":"Mirzaganj","label":"Mirzaganj","variants":["Mirzaganj"],"donor_count":15},
    {"value":"Patuakhali Sadar","label":"Patuakhali Sadar","variants":["Patuakhali Sadar"],"donor_count":270},
    {"value":"Rangabali","label":"Rangabali","variants":["Rangabali"],"donor_count":3}
  ],
  "Pirojpur": [
    {"value":"Bhandaria","label":"Bhandaria","variants":["Bhandaria"],"donor_count":59},
    {"value":"Indurkani","label":"Indurkani","variants":["Indurkani"],"donor_count":39},
    {"value":"Kawkhali","label":"Kawkhali","variants":["Kawkhali"],"donor_count":74},
    {"value":"Mathbaria","label":"Mathbaria","variants":["Mathbaria"],"donor_count":390},
    {"value":"Nazirpur","label":"Nazirpur","variants":["Nazirpur"],"donor_count":128},
    {"value":"Nesarabad","label":"Nesarabad","variants":["Nesarabad"],"donor_count":92},
    {"value":"Pirojpur Sadar","label":"Pirojpur Sadar","variants":["Pirojpur Sadar"],"donor_count":241},
    {"value":"Zianagar","label":"Zianagar","variants":["Zianagar"],"donor_count":38}
  ],
  "Rajbari": [
    {"value":"Baliakandi","label":"Baliakandi","variants":["Baliakandi"],"donor_count":152},
    {"value":"Goalanda","label":"Goalanda","variants":["Goalanda"],"donor_count":145},
    {"value":"Kalukhali","label":"Kalukhali","variants":["Kalukhali"],"donor_count":61},
    {"value":"Pangsha","label":"Pangsha","variants":["Pangsha"],"donor_count":203},
    {"value":"Rajbari Sadar","label":"Rajbari Sadar","variants":["Rajbari Sadar"],"donor_count":350}
  ],
  "Rajshahi": [
    {"value":"Bagha","label":"Bagha","variants":["Bagha"],"donor_count":952},
    {"value":"Bagmara","label":"Bagmara","variants":["Bagmara"],"donor_count":1787},
    {"value":"Boalia","label":"Boalia","variants":["Boalia"],"donor_count":780},
    {"value":"Charghat","label":"Charghat","variants":["Charghat"],"donor_count":997},
    {"value":"Durgapur","label":"Durgapur","variants":["Durgapur"],"donor_count":583},
    {"value":"Godagari","label":"Godagari","variants":["Godagari"],"donor_count":1423},
    {"value":"Mohanpur","label":"Mohanpur","variants":["Mohanpur"],"donor_count":641},
    {"value":"Motihar","label":"Motihar","variants":["Motihar"],"donor_count":235},
    {"value":"Paba","label":"Paba","variants":["Paba"],"donor_count":552},
    {"value":"Puthia","label":"Puthia","variants":["Puthia"],"donor_count":752},
    {"value":"Rajpara","label":"Rajpara","variants":["Rajpara"],"donor_count":287},
    {"value":"Shah Makhdum","label":"Shah Makhdum","variants":["Shah Makhdum"],"donor_count":107},
    {"value":"Tanore","label":"Tanore","variants":["Tanore"],"donor_count":1461}
  ],
  "Rangamati": [
    {"value":"Baghaichhari","label":"Baghaichhari","variants":["Baghaichhari"],"donor_count":6},
    {"value":"Barkal","label":"Barkal","variants":["Barkal"],"donor_count":1},
    {"value":"Belaichhari","label":"Belaichhari","variants":["Belaichhari"],"donor_count":5},
    {"value":"Betbunia","label":"Betbunia","variants":["Betbunia"],"donor_count":1},
    {"value":"Chandorghona","label":"Chandorghona","variants":["Chandorghona"],"donor_count":1},
    {"value":"Kaptai","label":"Kaptai","variants":["Kaptai"],"donor_count":371},
    {"value":"Kawkhali","label":"Kawkhali","variants":["Kawkhali"],"donor_count":22},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":7},
    {"value":"Langadu","label":"Langadu","variants":["Langadu"],"donor_count":35},
    {"value":"Naniarchar","label":"Naniarchar","variants":["Naniarchar"],"donor_count":6},
    {"value":"Rajasthali","label":"Rajasthali","variants":["Rajasthali"],"donor_count":7},
    {"value":"Rangamati Sadar","label":"Rangamati Sadar","variants":["Rangamati Sadar"],"donor_count":168}
  ],
  "Rangpur": [
    {"value":"Badarganj","label":"Badarganj","variants":["Badarganj"],"donor_count":195},
    {"value":"Gangachara","label":"Gangachara","variants":["Gangachara"],"donor_count":124},
    {"value":"Kaunia","label":"Kaunia","variants":["Kaunia"],"donor_count":42},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":56},
    {"value":"Mithapukur","label":"Mithapukur","variants":["Mithapukur"],"donor_count":45},
    {"value":"Pirgachha","label":"Pirgachha","variants":["Pirgachha"],"donor_count":94},
    {"value":"Pirganj","label":"Pirganj","variants":["Pirganj"],"donor_count":147},
    {"value":"Rangpur Sadar","label":"Rangpur Sadar","variants":["Rangpur Sadar"],"donor_count":533},
    {"value":"Taraganj","label":"Taraganj","variants":["Taraganj"],"donor_count":51}
  ],
  "Satkhira": [
    {"value":"Ashashuni","label":"Ashashuni","variants":["Ashashuni"],"donor_count":89},
    {"value":"Debhata","label":"Debhata","variants":["Debhata"],"donor_count":52},
    {"value":"Kalaroa","label":"Kalaroa","variants":["Kalaroa"],"donor_count":320},
    {"value":"Kaliganj","label":"Kaliganj","variants":["Kaliganj"],"donor_count":131},
    {"value":"Patkelghata","label":"Patkelghata","variants":["Patkelghata"],"donor_count":6},
    {"value":"Satkhira Sadar","label":"Satkhira Sadar","variants":["Satkhira Sadar"],"donor_count":392},
    {"value":"Shyamnagar","label":"Shyamnagar","variants":["Shyamnagar"],"donor_count":186},
    {"value":"Tala","label":"Tala","variants":["Tala"],"donor_count":178}
  ],
  "Shariatpur": [
    {"value":"Bhedarganj","label":"Bhedarganj","variants":["Bhedarganj"],"donor_count":207},
    {"value":"Damudya","label":"Damudya","variants":["Damudya"],"donor_count":165},
    {"value":"Gosairhat","label":"Gosairhat","variants":["Gosairhat"],"donor_count":135},
    {"value":"Jajira","label":"Jajira","variants":["Jajira"],"donor_count":214},
    {"value":"Naria","label":"Naria","variants":["Naria"],"donor_count":177},
    {"value":"Palong","label":"Palong","variants":["Palong"],"donor_count":37},
    {"value":"Sakhipur","label":"Sakhipur","variants":["Sakhipur"],"donor_count":15},
    {"value":"Shariatpur Sadar","label":"Shariatpur Sadar","variants":["Shariatpur Sadar"],"donor_count":170}
  ],
  "Sherpur": [
    {"value":"Jhenaigati","label":"Jhenaigati","variants":["Jhenaigati"],"donor_count":73},
    {"value":"Nakla","label":"Nakla","variants":["Nakla"],"donor_count":173},
    {"value":"Nalitabari","label":"Nalitabari","variants":["Nalitabari"],"donor_count":250},
    {"value":"Sherpur Sadar","label":"Sherpur Sadar","variants":["Sherpur Sadar"],"donor_count":317},
    {"value":"Sreebardi","label":"Sreebardi","variants":["Sreebardi"],"donor_count":45}
  ],
  "Sirajganj": [
    {"value":"Belkuchi","label":"Belkuchi","variants":["Belkuchi"],"donor_count":173},
    {"value":"Chauhali","label":"Chauhali","variants":["Chauhali"],"donor_count":471},
    {"value":"Enayetpur","label":"Enayetpur","variants":["Enayetpur"],"donor_count":8},
    {"value":"Kamarkanda","label":"Kamarkanda","variants":["Kamarkanda"],"donor_count":61},
    {"value":"Kazipur","label":"Kazipur","variants":["Kazipur"],"donor_count":90},
    {"value":"Raiganj","label":"Raiganj","variants":["Raiganj"],"donor_count":243},
    {"value":"Salanga","label":"Salanga","variants":["Salanga"],"donor_count":26},
    {"value":"Shahjadpur","label":"Shahjadpur","variants":["Shahjadpur"],"donor_count":333},
    {"value":"Sirajganj Sadar","label":"Sirajganj Sadar","variants":["Sirajganj Sadar"],"donor_count":436},
    {"value":"Tarash","label":"Tarash","variants":["Tarash"],"donor_count":126},
    {"value":"Ullapara","label":"Ullapara","variants":["Ullapara"],"donor_count":323}
  ],
  "Sunamganj": [
    {"value":"Bishwambharpur","label":"Bishwambharpur","variants":["Bishwambharpur"],"donor_count":13},
    {"value":"Chhatak","label":"Chhatak","variants":["Chhatak"],"donor_count":81},
    {"value":"Dakshin Sunamganj","label":"Dakshin Sunamganj","variants":["Dakshin Sunamganj"],"donor_count":15},
    {"value":"Derai","label":"Derai","variants":["Derai"],"donor_count":84},
    {"value":"Dharampasha","label":"Dharampasha","variants":["Dharampasha"],"donor_count":14},
    {"value":"Dowarabazar","label":"Dowarabazar","variants":["Dowarabazar"],"donor_count":79},
    {"value":"Jagannathpur","label":"Jagannathpur","variants":["Jagannathpur"],"donor_count":86},
    {"value":"Jamalganj","label":"Jamalganj","variants":["Jamalganj"],"donor_count":84},
    {"value":"Madaianagar","label":"Madaianagar","variants":["Madaianagar"],"donor_count":8},
    {"value":"Sullah","label":"Sullah","variants":["Sullah"],"donor_count":3},
    {"value":"Sunamganj Sadar","label":"Sunamganj Sadar","variants":["Sunamganj Sadar"],"donor_count":114},
    {"value":"Tahirpur","label":"Tahirpur","variants":["Tahirpur"],"donor_count":16}
  ],
  "Sylhet": [
    {"value":"Airport","label":"Airport","variants":["Airport"],"donor_count":19},
    {"value":"Balaganj","label":"Balaganj","variants":["Balaganj"],"donor_count":123},
    {"value":"Beanibazar","label":"Beanibazar","variants":["Beanibazar"],"donor_count":212},
    {"value":"Bishwanath","label":"Bishwanath","variants":["Bishwanath"],"donor_count":117},
    {"value":"Companiganj","label":"Companiganj","variants":["Companiganj"],"donor_count":58},
    {"value":"Dakshin Surma","label":"Dakshin Surma","variants":["Dakshin Surma"],"donor_count":412},
    {"value":"Fenchuganj","label":"Fenchuganj","variants":["Fenchuganj"],"donor_count":125},
    {"value":"Golapganj","label":"Golapganj","variants":["Golapganj"],"donor_count":236},
    {"value":"Gowainghat","label":"Gowainghat","variants":["Gowainghat"],"donor_count":84},
    {"value":"Jaintapur","label":"Jaintapur","variants":["Jaintapur"],"donor_count":26},
    {"value":"Jalalabad","label":"Jalalabad","variants":["Jalalabad"],"donor_count":39},
    {"value":"Kanaighat","label":"Kanaighat","variants":["Kanaighat"],"donor_count":37},
    {"value":"Kotwali","label":"Kotwali","variants":["Kotwali"],"donor_count":67},
    {"value":"Moglabazar","label":"Moglabazar","variants":["Moglabazar"],"donor_count":9},
    {"value":"Muglabazar","label":"Muglabazar","variants":["Muglabazar"],"donor_count":27},
    {"value":"Osmani Nagar","label":"Osmani Nagar","variants":["Osmani Nagar"],"donor_count":11},
    {"value":"Shahparan(R)","label":"Shahparan(R)","variants":["Shahparan(R)"],"donor_count":37},
    {"value":"Shahporan","label":"Shahporan","variants":["Shahporan"],"donor_count":45},
    {"value":"Sylhet Sadar","label":"Sylhet Sadar","variants":["Sylhet Sadar"],"donor_count":526},
    {"value":"Zakiganj","label":"Zakiganj","variants":["Zakiganj"],"donor_count":81}
  ],
  "Tangail": [
    {"value":"Basail","label":"Basail","variants":["Basail"],"donor_count":158},
    {"value":"Bhuapur","label":"Bhuapur","variants":["Bhuapur"],"donor_count":294},
    {"value":"Delduar","label":"Delduar","variants":["Delduar"],"donor_count":127},
    {"value":"Dhanbari","label":"Dhanbari","variants":["Dhanbari"],"donor_count":115},
    {"value":"Ghatail","label":"Ghatail","variants":["Ghatail"],"donor_count":319},
    {"value":"Gopalpur","label":"Gopalpur","variants":["Gopalpur"],"donor_count":297},
    {"value":"Kalihati","label":"Kalihati","variants":["Kalihati"],"donor_count":92},
    {"value":"Madhupur","label":"Madhupur","variants":["Madhupur"],"donor_count":236},
    {"value":"Mirzapur","label":"Mirzapur","variants":["Mirzapur"],"donor_count":205},
    {"value":"Nagarpur","label":"Nagarpur","variants":["Nagarpur"],"donor_count":298},
    {"value":"Sakhipur","label":"Sakhipur","variants":["Sakhipur"],"donor_count":195},
    {"value":"Tangail Sadar","label":"Tangail Sadar","variants":["Tangail Sadar"],"donor_count":471}
  ],
  "Thakurgaon": [
    {"value":"Baliadangi","label":"Baliadangi","variants":["Baliadangi"],"donor_count":259},
    {"value":"Haripur","label":"Haripur","variants":["Haripur"],"donor_count":257},
    {"value":"Pirganj","label":"Pirganj","variants":["Pirganj"],"donor_count":361},
    {"value":"Ranisankail","label":"Ranisankail","variants":["Ranisankail"],"donor_count":89},
    {"value":"Ruhia","label":"Ruhia","variants":["Ruhia"],"donor_count":39},
    {"value":"Thakurgaon Sadar","label":"Thakurgaon Sadar","variants":["Thakurgaon Sadar"],"donor_count":573}
  ]
};

export const UPAZILA_DISTRICTS = Object.keys(UPAZILAS_BY_DISTRICT);

function fold(value: string) {
  return value.normalize('NFC').toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, '');
}

const BY_DISTRICT_KEY = new Map(
  Object.entries(UPAZILAS_BY_DISTRICT).map(([district, list]) => [fold(district), list])
);

export function getUpazilasForDistrict(district: string): Upazila[] {
  if (typeof district !== 'string') return [];
  return BY_DISTRICT_KEY.get(fold(district)) || [];
}

/**
 * Resolves any stored spelling - canonical or variant, in either script - to
 * its entry. Matching is exact after folding; there are no upazila coordinates
 * in this project, so there is no distance-based fallback and none should be
 * invented.
 */
export function getUpazilaByName(district: string, name: string): Upazila | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  const key = fold(name);
  return getUpazilasForDistrict(district).find(item =>
    fold(item.value) === key || item.variants.some(variant => fold(variant) === key)
  ) || null;
}

export function isValidUpazila(district: string, name: string): boolean {
  return getUpazilaByName(district, name) !== null;
}

/**
 * Every stored spelling for a place, for building an `IN (...)` filter. An
 * unknown name resolves to itself so a caller never silently searches nothing.
 */
export function getUpazilaVariants(district: string, name: string): string[] {
  const upazila = getUpazilaByName(district, name);
  return upazila ? upazila.variants : [name];
}
