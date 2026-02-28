import re
import json
import random

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

def is_vowel(char):
    return char in 'AEIOU'

def get_invalid_variant(word, all_words):
    vowels = 'AEIOU'
    consonants = 'BCDFGHJKLMNPQRSTVWXYZ'
    
    # Try vowel substitution first
    word_vowels = [(i, c) for i, c in enumerate(word) if is_vowel(c)]
    
    if word_vowels:
        # Try to change a vowel to another vowel to make it invalid
        # Shuffle indices to be random
        random.shuffle(word_vowels)
        
        for idx, char in word_vowels:
            other_vowels = [v for v in vowels if v != char]
            random.shuffle(other_vowels)
            
            for v in other_vowels:
                new_word = word[:idx] + v + word[idx+1:]
                if new_word not in all_words:
                    return new_word, f"Replaced vowel {char} with {v}"

    # Fallback: Consonant substitution
    word_consonants = [(i, c) for i, c in enumerate(word) if not is_vowel(c)]
    if word_consonants:
        random.shuffle(word_consonants)
        for idx, char in word_consonants:
            other_cons = [c for c in consonants if c != char]
            random.shuffle(other_cons)
            
            for c in other_cons:
                new_word = word[:idx] + c + word[idx+1:]
                if new_word not in all_words:
                    return new_word, f"Replaced consonant {char} with {c}"
                    
    return None, None

def generate_puzzles():
    print("Loading dictionaries...")
    csw_words = parse_dictionary('frontend/public/CSW21.txt')
    nwl_words = parse_dictionary('frontend/public/NWL2023.txt')
    all_words = csw_words.union(nwl_words)
    
    print(f"Total unique words: {len(all_words)}")
    
    categories = {
        'two-letter': lambda w: len(w) == 2,
        'three-letter': lambda w: len(w) == 3,
        'four-letter': lambda w: len(w) == 4,
        'five-letter': lambda w: len(w) == 5,
        'q-no-u': lambda w: 'Q' in w and 'U' not in w,
        'j-x-z': lambda w: any(c in w for c in ['J', 'X', 'Z']),
        'v-words': lambda w: 'V' in w,
        'bingo': lambda w: len(w) == 7
    }
    
    puzzles = []
    
    for cat_name, filter_func in categories.items():
        print(f"Generating for {cat_name}...")
        candidates = [w for w in all_words if filter_func(w)]
        
        if len(candidates) < 5:
            print(f"Not enough words for {cat_name}")
            continue
            
        # Generate 10 puzzles per category
        for i in range(10):
            # Pick 5 random words
            selection = random.sample(candidates, 5)
            
            # Pick one to invalidate
            target_idx = random.randint(0, 4)
            target_word = selection[target_idx]
            
            invalid_word, reason = get_invalid_variant(target_word, all_words)
            
            # If we couldn't invalidate the target, try others
            if not invalid_word:
                for idx in range(5):
                    if idx == target_idx: continue
                    target_word = selection[idx]
                    invalid_word, reason = get_invalid_variant(target_word, all_words)
                    if invalid_word:
                        target_idx = idx
                        break
            
            if invalid_word:
                # Replace the valid word with the invalid one
                puzzle_words = list(selection)
                puzzle_words[target_idx] = invalid_word
                
                puzzles.append({
                    'id': f"{cat_name}-{i}",
                    'category': cat_name,
                    'words': puzzle_words,
                    'correctIndex': target_idx,
                    'originalWord': target_word,
                    'explanation': f"'{invalid_word}' is not a valid word. (Original was '{target_word}')"
                })
    
    output_path = 'frontend/src/data/oddOneOutData.js'
    print(f"Writing {len(puzzles)} puzzles to {output_path}")
    with open(output_path, 'w') as f:
        f.write("export const oddOneOutData = ")
        json.dump(puzzles, f, indent=4)
        f.write(";")

if __name__ == '__main__':
    generate_puzzles()
