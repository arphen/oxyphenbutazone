/**
 * Composable for playing sound effects
 * Create audio objects outside the function to persist across calls
 */

import { debug, logWarn, logError } from '../utils/log';

// Create audio pool outside to persist
let audioPool = null;
let isInitialized = false;

function initializeAudioPool() {
    if (!audioPool) {
        audioPool = [
            new Audio('/sounds/click1.mp3'),
            new Audio('/sounds/click2.mp3'),
            new Audio('/sounds/click3.mp3'),
            new Audio('/sounds/click4.mp3'),
            new Audio('/sounds/click5.mp3')
        ];

        // Preload all sounds
        audioPool.forEach((sound, index) => {
            sound.preload = 'auto';
            sound.volume = 0.7; // Increased volume to 70%

            // Add error handling with detailed logging
            sound.addEventListener('error', (e) => {
                logError(`Error loading sound ${index + 1}:`);
                logError('  - Error event:', e);
                logError('  - Audio src:', sound.src);
                logError('  - Audio error:', sound.error);
                if (sound.error) {
                    logError('  - Error code:', sound.error.code);
                    logError('  - Error message:', sound.error.message);
                    // Error codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
                    const errorMessages = {
                        1: 'MEDIA_ERR_ABORTED - The user canceled the audio',
                        2: 'MEDIA_ERR_NETWORK - A network error occurred',
                        3: 'MEDIA_ERR_DECODE - Error decoding audio file (corrupted/invalid format)',
                        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Audio format not supported'
                    };
                    logError('  - Error type:', errorMessages[sound.error.code] || 'Unknown error');
                }
            });

            // Log when sounds are loaded
            sound.addEventListener('canplaythrough', () => {
                debug(`Sound ${index + 1} loaded successfully`);
            });
        });

        isInitialized = true;
        debug('Audio pool initialized with', audioPool.length, 'sounds');
    }
    return audioPool;
}

export function useSoundEffects() {
    const clickSounds = initializeAudioPool();

    /**
     * Play a random click sound
     */
    const playClickSound = () => {
        try {
            // Pick a random sound from the array
            const randomIndex = Math.floor(Math.random() * clickSounds.length);
            const sound = clickSounds[randomIndex];

            debug(`Playing sound ${randomIndex + 1}, volume: ${sound.volume}`);

            // Clone the audio to allow overlapping plays
            const soundClone = sound.cloneNode();
            soundClone.volume = sound.volume;

            // Play the sound
            const playPromise = soundClone.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        debug(`Sound ${randomIndex + 1} played successfully`);
                    })
                    .catch(error => {
                        logError('Failed to play sound:', error.name, error.message);
                        // If autoplay is blocked, log helpful message
                        if (error.name === 'NotAllowedError') {
                            logWarn('Audio autoplay was blocked. User interaction may be required first.');
                        }
                    });
            }
        } catch (error) {
            logError('Error playing click sound:', error);
        }
    };

    /**
     * Set volume for all sounds (0.0 to 1.0)
     */
    const setVolume = (volume) => {
        const newVolume = Math.max(0, Math.min(1, volume));
        clickSounds.forEach(sound => {
            sound.volume = newVolume;
        });
        debug('Volume set to:', newVolume);
    };

    /**
     * Test play a sound (useful for debugging)
     */
    const testSound = () => {
        debug('Testing sound playback...');
        playClickSound();
    };

    return {
        playClickSound,
        setVolume,
        testSound
    };
}
