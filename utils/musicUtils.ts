
export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Regex para identificar acordes (Ex: C, C#m7, G/B, A9)
// Procura por letras A-G no início, opcionais #/b, opcionais complementos, opcional baixo /
const CHORD_REGEX = /\b[A-G](?:#|b)?(?:m|maj|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(?:\/[A-G](?:#|b)?)?\b/g;

export const transposeChord = (chord: string, steps: number): string => {
    // Detectar a escala dominante do acorde ANTES de transposicionar
    const hasFlat = /b/.test(chord.replace(/^[A-G]/, '')); // Ignora o B de "Bm"
    const preferFlat = /[DGCFb]b/.test(chord) || hasFlat;
    
    return chord.replace(/([A-G](?:#|b)?)/g, (note) => {
        // Usar a MESMA escala para todas as notas do acorde
        let index = NOTES_SHARP.indexOf(note);
        let scale = preferFlat ? NOTES_FLAT : NOTES_SHARP;
        
        if (index === -1) {
            index = NOTES_FLAT.indexOf(note);
        }
        
        if (index === -1) return note;
        
        let newIndex = (index + steps) % 12;
        if (newIndex < 0) newIndex += 12;
        
        return scale[newIndex];
    });
};

export const transposeText = (text: string, steps: number): string => {
    if (steps === 0) return text;
    
    // Divide em linhas para processar
    const lines = text.split('\n');
    
    const processedLines = lines.map(line => {
        // Heurística simples: Se a linha tem muitos acordes ou parece ser só acordes
        // Ou vamos tentar substituir qualquer coisa que pareça acorde
        
        // Estratégia segura: Substituir apenas palavras que dão match no Regex de acorde
        // e que não estão no meio de palavras (garantido pelo \b do regex)
        return line.replace(CHORD_REGEX, (match) => {
            return transposeChord(match, steps);
        });
    });
    
    return processedLines.join('\n');
};
