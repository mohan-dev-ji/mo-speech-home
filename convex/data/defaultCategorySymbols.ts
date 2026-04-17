/**
 * Default category and symbol seed data for new student profiles.
 *
 * Each CategorySeed defines:
 *   - symbolstixCategories: which SymbolStix `categories` values to query
 *   - words: ordered list of 48 words to seed (matched against symbols.words.eng)
 *
 * Each DropdownGroup defines 24 words for the core little-words dropdown.
 *
 * Seeding logic: for each word in the `words` array, find the first symbol
 * WHERE words.eng === word AND categories contains any of symbolstixCategories.
 * Insert as profileSymbol in order. Skip gracefully if no match found.
 *
 * Known custom symbol gaps (not in SymbolStix — need manual upload):
 *   - chocolate (not in any food category)
 *   - burger      - fridge        - sofa
 *   - fire engine  - tummy ache   - allergy
 *   - bear (wild) - ant           - worm
 *   - equals (maths symbol)       - christmas (standalone)
 *   - mum (UK — only "mother" exists)
 *
 * UK spelling gaps (US-only in SymbolStix):
 *   - mum → mother   - neighbour → neighbor
 *   - grey → gray    - favourite → favorite
 *   - aeroplane → airplane   - maths → math
 */

export type CategorySeed = {
  id: string;
  name: { eng: string; hin: string };
  icon: string;
  colour: string;
  /** SymbolStix categories[] values to include in the query */
  symbolstixCategories: string[];
  /** Ordered list of words.eng to seed — first 48 matches used */
  words: string[];
};

export type DropdownGroup = {
  id: string;
  name: { eng: string; hin: string };
  symbolstixCategories: string[];
  words: string[];
};

// ─── 17 Default Categories ────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    id: "actions",
    name: { eng: "Actions", hin: "Actions (hi)" },
    icon: "⚡",
    colour: "#F97316",
    symbolstixCategories: ["Actions"],
    words: [
      "want", "need", "go", "stop", "eat", "drink", "help", "play",
      "look", "come", "get", "open", "close", "give", "put", "see",
      "finish", "like", "love", "sit", "walk", "watch", "sleep", "wash",
      "read", "listen", "talk", "say", "make", "take", "have", "feel",
      "run", "jump", "throw", "catch", "draw", "write", "sing", "dance",
      "try", "wait", "share", "smile", "laugh", "cry", "hug", "turn",
    ],
  },
  {
    id: "people",
    name: { eng: "People", hin: "People (hi)" },
    icon: "👥",
    colour: "#A855F7",
    // Note: teacher/doctor/nurse/firefighter/police officer/dentist/driver live in Occupations
    symbolstixCategories: [
      "People Symbolstix", "People", "Family", "Occupations",
    ],
    words: [
      "mother", "father", "brother", "sister", "baby", "family",
      "grandmother", "grandfather", "aunt", "uncle", "daughter", "son",
      "husband", "wife", "parent", "cousin", "twin", "partner",
      "friend", "boy", "girl", "man", "woman", "child", "children",
      "adult", "teenager", "toddler", "patient", "student",
      "stranger", "neighbor", "helper", "volunteer", "team", "anybody",
      "teacher", "doctor", "nurse", "firefighter", "police officer",
      "dentist", "driver", "hero", "princess", "prince", "king", "queen",
    ],
  },
  {
    id: "feelings",
    name: { eng: "Feelings", hin: "Feelings (hi)" },
    icon: "😊",
    colour: "#EC4899",
    symbolstixCategories: ["Feelings"],
    // Note: "tired" does not exist in Feelings — needs custom symbol
    words: [
      "happy", "sad", "angry", "scared", "excited", "surprised",
      "calm", "confused", "worried", "frustrated", "bored", "nervous",
      "proud", "silly", "lonely", "embarrassed", "shy", "curious",
      "jealous", "disappointed", "upset", "guilty", "amused",
      "hungry", "sick", "overstimulated", "hurt feelings", "i need a break",
      "okay", "good", "bad", "glad", "mad", "grumpy", "annoyed",
      "afraid", "ashamed", "stressed", "relieved", "terrified",
      "meh", "cheeky", "depressed", "discouraged", "irritated",
      "uncertain", "brave", "homesick",
    ],
  },
  {
    id: "describe",
    name: { eng: "Describe", hin: "Describe (hi)" },
    icon: "🔵",
    colour: "#14B8A6",
    // Note: "grey" not in DB — use "gray". "favourite" not in DB — use "favorite"
    symbolstixCategories: ["Descriptives", "Colors & Shapes"],
    words: [
      "red", "blue", "green", "yellow", "orange", "purple", "pink",
      "black", "white", "brown",
      "big", "small", "tall", "short", "long", "thin",
      "hot", "cold", "warm", "soft", "hard", "wet", "dry", "heavy", "light",
      "fast", "slow",
      "loud", "quiet",
      "sweet", "sour", "spicy", "yummy",
      "good", "nice", "beautiful", "clean", "dirty", "new", "old", "special",
      "same", "different",
      "more", "less",
      "first", "last", "next",
    ],
  },
  {
    id: "food-and-drink",
    name: { eng: "Food & Drink", hin: "Food & Drink (hi)" },
    icon: "🍎",
    colour: "#EF4444",
    // Note: "chocolate" not in any food category — needs custom symbol
    // Note: "burger" not in DB — needs custom symbol
    symbolstixCategories: [
      "Food & Drink", "Drinks", "Sweets & Desserts", "Fruits",
      "Vegetables", "Meat", "Grains", "Dairy", "Fish / Ocean",
      "Sandwiches", "Soups",
    ],
    words: [
      "food", "drink", "breakfast", "lunch", "dinner", "snack",
      "water", "juice", "milk", "tea", "coffee", "hot chocolate", "smoothie",
      "bread", "toast", "cereal", "rice", "pasta",
      "egg", "cheese", "butter",
      "chicken", "sausage", "ham", "bacon", "fish",
      "apple", "banana", "orange", "grapes", "strawberry", "pear", "mango",
      "carrot", "peas", "broccoli", "potato", "tomato",
      "pizza", "sandwich", "soup", "salad", "chips",
      "ice cream", "cake", "cookie", "sweets", "donut",
    ],
  },
  {
    id: "home",
    name: { eng: "Home", hin: "Home (hi)" },
    icon: "🏠",
    colour: "#3B82F6",
    // Note: "fridge" not in DB — needs custom symbol
    // Note: "sofa" not in DB — needs custom symbol
    // Note: "phone" not in DB — needs custom symbol
    // Note: "nappy" not in DB (UK) — "diaper" exists in Health
    symbolstixCategories: [
      "Home", "Kitchen", "Furniture",
      "Grooming", "Personal",
      "Technology", "Computer",
      "Plants", "Transportation",
      "TV, Movies & Books",
    ],
    words: [
      "bedroom", "bathroom", "kitchen", "living room", "toilet",
      "bed", "chair", "table", "desk", "wardrobe", "pillow", "blanket",
      "cup", "plate", "bowl", "spoon", "fork", "knife",
      "oven", "microwave", "kettle", "toaster", "sink", "dishwasher",
      "shower", "toothbrush", "toothpaste", "soap", "towel", "toilet paper",
      "tv", "computer", "remote control",
      "washing machine", "vacuum", "iron",
      "door", "window", "stairs", "floor", "wall", "lamp", "alarm clock",
      "key", "bin", "garden", "car", "book",
    ],
  },
  {
    id: "activities",
    name: { eng: "Activities", hin: "Activities (hi)" },
    icon: "⚽",
    colour: "#22C55E",
    // Note: "swimming" (noun) not in DB — "swim" used instead
    // Note: "guitar" not in DB — violin/drums/piano available
    // Note: "cinema" not in DB — "movie" covers intent
    symbolstixCategories: [
      "Leisure, Games & Toys", "Sports", "Arts & Crafts", "Games",
      "Toys", "Music",
      "Football", "Basketball", "Tennis",
      "Actions",
      "General", "Community",
      "TV, Movies & Books", "Technology",
      "Holidays", "Yard", "Places",
    ],
    words: [
      "swim", "run", "football", "basketball", "tennis", "gymnastics",
      "karate", "yoga", "dance", "cycling", "surfing", "race",
      "art", "craft", "painting", "drawing", "music", "sing", "song", "piano",
      "game", "video game", "board game", "puzzle", "lego", "chess",
      "hide and seek", "doll", "ball", "trampoline",
      "party", "birthday", "movie", "television", "youtube",
      "park", "playground", "beach", "library", "camping",
      "exercise", "sport", "walk", "hike", "gardening",
      "outdoors", "trip", "holiday",
    ],
  },
  {
    id: "school",
    name: { eng: "School", hin: "School (hi)" },
    icon: "📚",
    colour: "#EAB308",
    // Note: "maths" not in DB — "math" used (US spelling). Custom label override needed for UK
    // Note: "PE" / "physical education" not usable — needs custom symbol
    // Note: "headteacher" not in DB — "principal" used (US term)
    // Note: "assembly" not in DB
    symbolstixCategories: [
      "School", "Language Arts", "Science",
      "Occupations", "Buildings", "Community",
      "Arts & Crafts", "Furniture", "Technology", "Computer",
      "Letters & Numbers", "Actions", "People Symbolstix",
      "Days of Week",
    ],
    words: [
      "school", "classroom", "library", "playground", "gym",
      "teacher", "student",
      "math", "english", "science", "art", "music", "history",
      "pencil", "pen", "scissors", "paper", "glue", "book",
      "notebook", "backpack", "eraser",
      "desk", "chair", "whiteboard", "computer", "tablet",
      "alphabet", "number", "letter", "word", "sentence", "question", "answer",
      "read", "write", "draw", "count", "learn",
      "friend", "team", "school bus",
      "homework", "test", "recess", "lunch",
      "monday", "friday",
    ],
  },
  {
    id: "health",
    name: { eng: "Health", hin: "Health (hi)" },
    icon: "❤️",
    colour: "#F43F5E",
    // Note: "tummy ache" not in DB — needs custom symbol
    // Note: "allergy" not in DB — needs custom symbol
    // Note: "plaster" not in DB (UK) — "bandage" covers it
    // Note: "nappy" not in DB — "diaper" in Health exists
    symbolstixCategories: [
      "Health", "Body Parts", "Grooming", "Cleaning",
      "Occupations", "Buildings", "Transportation",
      "Clothing & Shoes",
      "Descriptives", "Feelings", "Actions",
      "Personal", "Calendar & Time", "Eating",
    ],
    words: [
      "head", "face", "eye", "ear", "nose", "mouth", "teeth",
      "hand", "arm", "leg", "foot", "tummy",
      "sick", "pain", "hurt", "fever", "headache", "cold",
      "cough", "sneeze", "dizzy", "rash",
      "doctor", "nurse", "hospital", "medicine", "bandage", "injection",
      "ambulance", "wheelchair", "hearing aid", "glasses",
      "wash", "brush teeth", "brush hair", "shower", "toilet",
      "sleep", "rest", "exercise", "relax", "emergency",
      "hungry", "thirsty", "tired",
      "inhaler", "appointment", "thermometer",
    ],
  },
  {
    id: "animals",
    name: { eng: "Animals", hin: "Animals (hi)" },
    icon: "🐾",
    colour: "#F59E0B",
    // Note: "bear" only in American Sign Language — needs custom symbol
    // Note: "hippo" only in American Sign Language — needs custom symbol
    // Note: "whale" only in Characters/Religion — needs custom symbol
    // Note: "ant" and "worm" not in DB at all
    // Note: "ladybird" not in DB — "ladybug" (US spelling) used
    symbolstixCategories: [
      "Animals", "Birds", "Insects", "Fish / Ocean", "Dogs",
    ],
    words: [
      "dog", "cat", "rabbit", "hamster", "goldfish",
      "horse", "cow", "pig", "sheep", "goat", "chicken", "duck",
      "lion", "tiger", "elephant", "giraffe", "monkey", "zebra",
      "fox", "deer", "wolf", "crocodile", "rhinoceros", "cheetah",
      "shark", "dolphin", "fish", "crab", "octopus", "turtle",
      "seahorse", "jellyfish",
      "eagle", "owl", "penguin", "flamingo", "robin", "parrot",
      "peacock", "crow",
      "butterfly", "bee", "spider", "ladybug", "caterpillar",
      "dragonfly", "grasshopper", "moth",
    ],
  },
  {
    id: "nature",
    name: { eng: "Nature", hin: "Nature (hi)" },
    icon: "🌿",
    colour: "#10B981",
    symbolstixCategories: [
      "Nature", "Weather", "Seasons", "Landforms",
      "Continents & Bodies of Water", "Plants", "Flowers",
      "Outer Space", "Colors & Shapes",
    ],
    words: [
      "sun", "rain", "snow", "cloud", "wind", "rainbow",
      "storm", "thunder", "fog", "ice", "weather", "sky",
      "spring", "summer", "autumn", "winter",
      "mountain", "hill", "river", "lake", "ocean", "sea",
      "beach", "waterfall", "forest", "desert", "cave", "valley",
      "rock", "sand", "mud", "soil", "grass", "leaf", "tree", "flower",
      "bush", "seed", "garden", "jungle", "meadow", "field",
      "moon", "star", "earth", "sunrise", "sunset", "night",
    ],
  },
  {
    id: "community",
    name: { eng: "Community", hin: "Community (hi)" },
    icon: "🏘️",
    colour: "#6366F1",
    // Note: "aeroplane" not in DB (UK) — "airplane" used
    // Note: "fire engine" not in DB — needs custom symbol
    // Note: "cinema" not in DB
    // Note: "cafe" not in DB
    symbolstixCategories: [
      "Community", "Transportation", "Buildings", "Stores",
      "Shopping", "Occupations", "Money",
      "Places", "Signs",
    ],
    words: [
      "hospital", "school", "library", "park", "playground",
      "restaurant", "shop", "supermarket", "church", "police station",
      "fire station", "bank", "post office", "pharmacy",
      "car", "bus", "train", "bicycle", "airplane", "helicopter",
      "boat", "ship", "taxi", "ambulance", "police car",
      "lorry", "truck", "van", "motorbike", "tractor",
      "police officer", "firefighter", "doctor", "nurse",
      "money", "coin", "pay", "road", "street", "bridge",
      "zoo", "museum", "farm", "town", "city",
      "swimming pool", "hotel", "market",
    ],
  },
  {
    id: "time",
    name: { eng: "Time", hin: "Time (hi)" },
    icon: "⏰",
    colour: "#0EA5E9",
    symbolstixCategories: [
      "Calendar & Time", "Days of Week", "Months", "Seasons",
      "Descriptives", "Adverbs", "Conjunctions",
      "General", "Holidays", "Actions",
    ],
    words: [
      "monday", "tuesday", "wednesday", "thursday", "friday",
      "saturday", "sunday",
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
      "spring", "summer", "autumn", "winter",
      "morning", "afternoon", "evening", "night", "bedtime",
      "today", "tomorrow", "yesterday", "now", "soon", "later",
      "before", "after",
      "first", "last", "next", "early",
      "always", "never", "sometimes",
      "minute", "hour", "week", "year",
      "birthday",
    ],
  },
  {
    id: "numbers",
    name: { eng: "Numbers", hin: "Numbers (hi)" },
    icon: "🔢",
    colour: "#06B6D4",
    // Note: "equals" not in DB — needs custom symbol
    // Note: "minus" only in American Sign Language — needs custom symbol
    // Note: metric measurements (centimetre, metre, litre) not in DB
    symbolstixCategories: [
      "Letters & Numbers", "Math", "Money", "Measurement",
      "Descriptives", "Actions",
    ],
    words: [
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
      "11", "12", "15", "20", "25", "50", "100",
      "add", "subtract", "multiply", "divide", "count",
      "total", "half", "quarter", "fraction", "amount",
      "more", "less", "some", "many", "few", "all", "none",
      "first", "second", "third", "number",
      "money", "pound", "penny", "coin", "pay", "change",
      "free", "expensive", "cheap",
    ],
  },
  {
    id: "chat",
    name: { eng: "Chat", hin: "Chat (hi)" },
    icon: "💬",
    colour: "#F472B6",
    symbolstixCategories: ["Interjections", "Greetings & Wrap ups"],
    words: [
      "hi", "hello", "good morning!", "good night.", "goodbye!", "bye!",
      "see you later!",
      "yes", "no", "okay", "please", "thank you!", "you're welcome!",
      "sorry", "excuse me.", "of course", "help!",
      "wow!", "hooray!", "amazing", "awesome", "great", "cool", "yeah!",
      "no way!", "oops!", "uh-oh!", "oh no!", "oh!", "ahhh!", "ha-ha-ha!",
      "boo",
      "what's up?", "really", "what", "well", "come back",
      "have a nice day.", "be careful!", "bless you!", "congratulations!",
      "glad to meet you.", "happy holidays!",
      "darn!", "duh", "yuck", "yum",
      "later alligator!",
    ],
  },
  {
    id: "questions",
    name: { eng: "Questions", hin: "Questions (hi)" },
    icon: "❓",
    colour: "#7C3AED",
    symbolstixCategories: ["Questions"],
    words: [
      "how", "can i", "do you", "what is", "where is", "may i",
      "am i", "what if",
      "how are you?", "how is it going?", "what about you?",
      "are you coming?", "guess what?", "do you understand?",
      "do you like it?", "is it okay?", "is something wrong?",
      "what is that?", "what is the matter?", "what is next?",
      "is it time?", "when is it my turn?", "whose turn?",
      "who is that?", "what did you say?", "how long", "how much?",
      "any more?", "anything?", "are we there yet?",
      "can i play?", "can i help?", "can i have some?", "can i go?",
      "can you help me?", "do you want to", "play with me?",
      "do i have to?",
      "what did you do today?", "what did you think?",
      "what do you want to watch on tv?", "what game do you want to play?",
      "what is your name?", "who goes first?", "where are you going?",
      "when are we going?", "when are we eating?", "when is your birthday?",
    ],
  },
  {
    id: "religion",
    name: { eng: "Religion", hin: "Religion (hi)" },
    icon: "🙏",
    colour: "#D97706",
    // Note: "christmas" standalone not in Religion — "christmas manger scene" used
    // Note: "shabbat" not in DB standalone
    // Note: "meditation" / "blessing" / "faith" not in DB
    symbolstixCategories: [
      "Religion", "Buildings", "Holidays", "Actions",
    ],
    words: [
      "pray", "prayer", "god", "holy", "worship", "miracle",
      "soul", "grace", "religion", "angel", "heaven",
      "church", "bible", "jesus", "cross", "easter sunday",
      "baptism", "communion", "saint", "hymn", "advent",
      "christmas manger scene",
      "mosque", "allah", "quran", "ramadan", "eid al-fitr",
      "eid al-adha", "imam", "hajj",
      "synagogue", "torah", "hanukkah", "passover", "star of david",
      "menorah", "rosh hashanah", "yom kippur",
      "temple", "hinduism", "diwali", "krishna", "holi",
      "sikhism", "sikh",
      "buddhism", "buddha", "vesak",
    ],
  },
];

// ─── Little Words Dropdown Groups (6 × 25) ───────────────────────────────────

export const LITTLE_WORDS_GROUPS: DropdownGroup[] = [
  {
    id: "core-a",
    name: { eng: "Core words A", hin: "Core words A (hi)" },
    symbolstixCategories: ["SymbolStix Squares Core Vocabulary Set 1"],
    words: [
      "yes", "please", "more", "stop", "good", "bad", "happy", "sad",
      "me", "my", "he", "she", "we", "they", "all", "same",
      "different", "big", "little", "what", "how", "who", "and", "but",
    ],
  },
  {
    id: "core-b",
    name: { eng: "Core words B", hin: "Core words B (hi)" },
    symbolstixCategories: ["SymbolStix Squares Core Vocabulary Set 2"],
    words: [
      "want", "need", "help", "go", "come", "eat", "drink", "play",
      "open", "close", "finished", "look", "see", "feel", "do",
      "can", "have", "make", "get", "put", "say", "tell", "like", "now",
    ],
  },
  {
    id: "pronouns",
    name: { eng: "Pronouns", hin: "Pronouns (hi)" },
    symbolstixCategories: ["Pronouns"],
    words: [
      "I", "you", "he", "she", "we", "they", "me", "him", "her",
      "us", "them", "it", "mine", "yours", "his", "hers", "ours",
      "theirs", "myself", "yourself", "everyone", "nobody", "someone", "anybody",
    ],
  },
  {
    id: "joining-words",
    name: { eng: "Joining words", hin: "Joining words (hi)" },
    symbolstixCategories: ["Conjunctions"],
    words: [
      "and", "but", "or", "because", "if", "when", "where", "who",
      "why", "so", "although", "after", "before", "while", "since",
      "until", "either", "both", "as", "than", "though", "yet", "for",
    ],
  },
  {
    id: "position-words",
    name: { eng: "Position words", hin: "Position words (hi)" },
    symbolstixCategories: ["Articles & Prepositions"],
    words: [
      "in", "on", "at", "the", "a", "an", "with", "to", "from",
      "of", "by", "over", "under", "up", "down", "near", "between",
      "behind", "beside", "around", "through", "past", "inside", "about",
    ],
  },
  {
    id: "time-and-manner",
    name: { eng: "Time & manner", hin: "Time & manner (hi)" },
    symbolstixCategories: ["Adverbs"],
    words: [
      "now", "today", "tomorrow", "yesterday", "here", "there",
      "maybe", "never", "soon", "very", "just", "almost", "away",
      "far", "outside", "inside", "anywhere", "somewhere", "early",
      "yet", "well", "else", "instead", "even",
    ],
  },
];
