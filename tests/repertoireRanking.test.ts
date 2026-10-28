import { describe, it, expect } from 'vitest';
import { 
  calculateSongsRanking, 
  partitionPlaylists, 
  normalizeSongTitle,
  filterSongRanking 
} from '../utils/repertoireUtils';
import { RepertoireItem } from '../types';

describe('Repertoire Ranking & Playlist Archiving (repertoireRanking)', () => {
  describe('normalizeSongTitle', () => {
    it('deve normalizar títulos removendo espaços redundantes e padronizando maiúsculas/minúsculas', () => {
      expect(normalizeSongTitle('  Porque Ele Vive  ')).toBe('porque ele vive');
      expect(normalizeSongTitle('Bondade de Deus - Isaías Saad')).toBe('bondade de deus - isaias saad');
      expect(normalizeSongTitle('Raridade (Anderson Freire)')).toBe('raridade (anderson freire)');
    });
  });

  describe('calculateSongsRanking', () => {
    const mockItems: RepertoireItem[] = [
      {
        id: '1',
        title: 'Bondade de Deus',
        date: '2026-10-10',
        link: 'https://youtube.com/watch?v=1',
        addedBy: 'Admin',
        observation: 'Culto: Domingo Noite (19:00)'
      },
      {
        id: '2',
        title: 'Porque Ele Vive',
        date: '2026-10-10',
        link: 'https://youtube.com/watch?v=2',
        addedBy: 'Admin',
        observation: 'Culto: Domingo Noite (19:00)'
      },
      {
        id: '3',
        title: 'bondade de deus ', // variação de caixa e espaço
        date: '2026-10-17',
        link: 'https://youtube.com/watch?v=1b',
        addedBy: 'Líder',
        observation: 'Culto: Domingo Noite (19:00)'
      },
      {
        id: '4',
        title: 'Bondade De Deus',
        date: '2026-10-24',
        link: 'https://youtube.com/watch?v=1c',
        addedBy: 'Ministro',
        observation: 'Culto: Domingo Noite (19:00)'
      },
      {
        id: '5',
        title: 'Em Teus Braços',
        date: '2026-10-24',
        link: 'https://youtube.com/watch?v=3',
        addedBy: 'Admin',
        observation: 'Culto: Domingo Noite (19:00)'
      }
    ];

    it('deve contabilizar a quantidade de vezes que cada louvor foi escolhido', () => {
      const ranking = calculateSongsRanking(mockItems);

      expect(ranking.length).toBe(3); // 'Bondade de Deus', 'Porque Ele Vive', 'Em Teus Braços'
      
      // Bondade de Deus apareceu 3 vezes
      const topSong = ranking[0];
      expect(topSong.displayTitle).toBe('Bondade De Deus'); // Título preservado
      expect(topSong.count).toBe(3);
      expect(topSong.lastDate).toBe('2026-10-24');
      expect(topSong.occurrences.length).toBe(3);
    });

    it('deve desempatar por data mais recente quando duas músicas tiverem a mesma contagem', () => {
      const ranking = calculateSongsRanking(mockItems);

      // 'Em Teus Braços' (2026-10-24) vs 'Porque Ele Vive' (2026-10-10), ambas com 1 escolha
      expect(ranking[1].normalizedTitle).toBe('em teus bracos');
      expect(ranking[1].count).toBe(1);
      expect(ranking[1].lastDate).toBe('2026-10-24');

      expect(ranking[2].normalizedTitle).toBe('porque ele vive');
      expect(ranking[2].count).toBe(1);
      expect(ranking[2].lastDate).toBe('2026-10-10');
    });
  });

  describe('partitionPlaylists', () => {
    it('deve separar a playlist em destaque do próximo culto, futuras e histórico de passadas', () => {
      const groups = [
        {
          groupKey: '2026-10-25_noite_19:00',
          date: '2026-10-25',
          cultoTitle: 'Culto Domingo Noite',
          cultoTime: '19:00',
          items: [{ id: '1', title: 'Música 1' } as any],
          isPast: true,
          isNext: false
        },
        {
          groupKey: '2026-10-18_noite_19:00',
          date: '2026-10-18',
          cultoTitle: 'Culto Domingo Noite',
          cultoTime: '19:00',
          items: [{ id: '2', title: 'Música 2' } as any],
          isPast: true,
          isNext: false
        },
        {
          groupKey: '2026-11-01_manha_09:30',
          date: '2026-11-01',
          cultoTitle: 'Culto Domingo Manhã',
          cultoTime: '09:30',
          items: [{ id: '3', title: 'Música 3' } as any],
          isPast: false,
          isNext: true
        },
        {
          groupKey: '2026-11-01_noite_19:00',
          date: '2026-11-01',
          cultoTitle: 'Culto Domingo Noite',
          cultoTime: '19:00',
          items: [{ id: '4', title: 'Música 4' } as any],
          isPast: false,
          isNext: false
        }
      ];

      const partitioned = partitionPlaylists(groups);

      // Próximo culto em destaque
      expect(partitioned.nextPlaylist).toBeDefined();
      expect(partitioned.nextPlaylist?.groupKey).toBe('2026-11-01_manha_09:30');

      // Futuros restantes
      expect(partitioned.upcomingPlaylists.length).toBe(1);
      expect(partitioned.upcomingPlaylists[0].groupKey).toBe('2026-11-01_noite_19:00');

      // Passados
      expect(partitioned.pastPlaylists.length).toBe(2);
      expect(partitioned.pastPlaylists.map(p => p.groupKey)).toEqual([
        '2026-10-25_noite_19:00',
        '2026-10-18_noite_19:00'
      ]);
    });
  });

  describe('filterSongRanking', () => {
    it('deve filtrar músicas por texto de busca sem diferenciar maiúsculas ou acentos', () => {
      const items = [
        { normalizedTitle: 'bondade de deus', displayTitle: 'Bondade de Deus', count: 3, lastDate: '2026-10-24' } as any,
        { normalizedTitle: 'porque ele vive', displayTitle: 'Porque Ele Vive', count: 2, lastDate: '2026-10-10' } as any,
        { normalizedTitle: 'vitorioso és', displayTitle: 'Vitorioso És', count: 1, lastDate: '2026-10-05' } as any
      ];

      const res1 = filterSongRanking(items, 'vitorioso');
      expect(res1.length).toBe(1);
      expect(res1[0].displayTitle).toBe('Vitorioso És');

      const res2 = filterSongRanking(items, 'deus');
      expect(res2.length).toBe(1);
      expect(res2[0].displayTitle).toBe('Bondade de Deus');
    });
  });
});

