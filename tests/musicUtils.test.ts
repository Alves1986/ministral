import { describe, it, expect } from 'vitest';
import { transposeChord } from '../utils/musicUtils';

describe('transposeChord', () => {
    it('should transpose C by 2 steps to D', () => {
        expect(transposeChord('C', 2)).toBe('D');
    });

    it('should transpose Db by 2 steps to Eb (maintaining flat)', () => {
        expect(transposeChord('Db', 2)).toBe('Eb');
    });

    it('should transpose C# by 2 steps to D# (maintaining sharp)', () => {
        expect(transposeChord('C#', 2)).toBe('D#');
    });

    it('should transpose G/B by 5 steps to C/E', () => {
        expect(transposeChord('G/B', 5)).toBe('C/E');
    });

    it('should transpose Dbm7 by -1 steps to Cm7', () => {
        expect(transposeChord('Dbm7', -1)).toBe('Cm7');
    });

    it('should handle mixed chords correctly (heuristic)', () => {
        // Testando se a escala é mantida consistente no acorde
        // Db/F transposto em 2 semitons -> Eb/G
        expect(transposeChord('Db/F', 2)).toBe('Eb/G');
    });
});
