import re
import json
import os

TILE_VALUES = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
    'D': 2, 'G': 2,
    'B': 3, 'C': 3, 'M': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5,
    'J': 8, 'X': 8,
    'Q': 10, 'Z': 10
}

def get_word_score(word):
    return sum(TILE_VALUES.get(c, 0) for c in word.upper())

CATEGORIES = {
    'two-letter': lambda w, _: len(w) == 2,
    'three-letter': lambda w, _: len(w) == 3 and get_word_score(w) >= 7, # Focus on high scoring
    'four-letter': lambda w, _: len(w) == 4,
    'five-letter': lambda w, _: len(w) == 5,
    'q-no-u': lambda w, _: 'Q' in w and 'U' not in w,
    'j-x-z': lambda w, _: any(c in w for c in ['J', 'X', 'Z']),
    'v-words': lambda w, _: 'V' in w,
    'extensions': lambda w, twos: len(w) == 3 and (w[1:] in twos or w[:-1] in twos)
}

def parse_dictionary(filepath):
    words = set()
    try:
        with open(filepath, 'r') as f:
            for line in f:
                match = re.match(r'^([A-Z]+)', line)
                if match:
                    words.add(match.group(1))
    except FileNotFoundError:
        print(f"Warning: {filepath} not found.")
    return words

def generate_corpuses():
    print("Loading dictionaries...")
    csw_words = parse_dictionary('frontend/public/CSW21.txt')
    nwl_words = parse_dictionary('frontend/public/NWL2023.txt')
    
    all_words = csw_words.union(nwl_words)
    print(f"Total unique words: {len(all_words)}")
    
    two_letter_words = {w for w in all_words if len(w) == 2}
    
    # Initialize data structure for each category
    # { category: { word: [dict1, dict2] } }
    category_data = {cat: {} for cat in CATEGORIES}
    
    for word in all_words:
        dicts = []
        if word in csw_words: dicts.append('CSW21')
        if word in nwl_words: dicts.append('NWL2023')
        
        for cat_name, filter_func in CATEGORIES.items():
            if filter_func(word, two_letter_words):
                category_data[cat_name][word] = dicts

    output_dir = 'frontend/src/data/corpuses'
    os.makedirs(output_dir, exist_ok=True)
    
    for cat_name, data in category_data.items():
        filepath = os.path.join(output_dir, f'{cat_name}.json')
        print(f"Writing {len(data)} words to {filepath}")
        with open(filepath, 'w') as f:
            json.dump(data, f)

if __name__ == '__main__':
    generate_corpuses()
