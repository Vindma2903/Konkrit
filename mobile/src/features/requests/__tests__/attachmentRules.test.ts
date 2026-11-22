import { plural } from '@/lib/plural';

import { formatMb, planAdd, validateFile } from '../attachmentRules';
import type { PickedFile } from '../pickers';

const MB = 1024 * 1024;

const image = (name: string, size = MB): PickedFile => ({
  uri: `file:///${name}`,
  name,
  size,
  kind: 'image',
});

describe('validateFile', () => {
  it('принимает фото до 20 МБ и отклоняет больше', () => {
    expect(validateFile(image('a.jpg', 20 * MB))).toBeNull();
    expect(validateFile(image('big.jpg', 20 * MB + 1))).toBe('big.jpg: файл больше 20 МБ');
  });

  it('для видео лимит 100 МБ', () => {
    const video = (size: number): PickedFile => ({
      uri: 'file:///v.mp4',
      name: 'v.mp4',
      size,
      kind: 'video',
    });
    expect(validateFile(video(100 * MB))).toBeNull();
    expect(validateFile(video(100 * MB + 1))).toBe('v.mp4: файл больше 100 МБ');
  });

  it('документ: PDF, DOC и DOCX по типу, остальное отклоняется', () => {
    const doc = (name: string, mimeType?: string): PickedFile => ({
      uri: `file:///${name}`,
      name,
      mimeType,
      size: MB,
      kind: 'document',
    });
    expect(validateFile(doc('a.pdf', 'application/pdf'))).toBeNull();
    expect(validateFile(doc('a.doc', 'application/msword'))).toBeNull();
    expect(
      validateFile(
        doc('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ),
    ).toBeNull();
    expect(validateFile(doc('a.exe', 'application/x-msdownload'))).toBe(
      'a.exe: такой тип файла не поддерживается',
    );
  });

  it('если система не назвала тип, смотрит на расширение', () => {
    const doc = (name: string): PickedFile => ({
      uri: `file:///${name}`,
      name,
      size: MB,
      kind: 'document',
    });
    expect(validateFile(doc('scan.PDF'))).toBeNull();
    expect(validateFile(doc('archive.zip'))).toBe('archive.zip: такой тип файла не поддерживается');
  });

  it('неизвестный размер не мешает добавить файл', () => {
    expect(validateFile({ uri: 'file:///a.jpg', name: 'a.jpg', kind: 'image' })).toBeNull();
  });
});

describe('planAdd', () => {
  it('добавляет всё, что подходит и помещается', () => {
    const plan = planAdd([image('a.jpg'), image('b.jpg')], 3);
    expect(plan.accepted).toHaveLength(2);
    expect(plan.messages).toEqual([]);
  });

  it('обрезает по лимиту: при 8 файлах и 5 выбранных добавляются 2', () => {
    const files = ['a', 'b', 'c', 'd', 'e'].map((name) => image(`${name}.jpg`));
    const plan = planAdd(files, 8);
    expect(plan.accepted.map((file) => file.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(plan.messages).toEqual(['Добавлено 2 из 5: максимум 10 вложений']);
  });

  it('при полном списке не добавляет ничего', () => {
    const plan = planAdd([image('a.jpg')], 10);
    expect(plan.accepted).toEqual([]);
    expect(plan.messages).toEqual(['Добавлено 0 из 1: максимум 10 вложений']);
  });

  it('отклонённые файлы получают свои сообщения и не занимают места', () => {
    const plan = planAdd([image('big.jpg', 30 * MB), image('ok.jpg')], 9);
    expect(plan.accepted.map((file) => file.name)).toEqual(['ok.jpg']);
    expect(plan.messages).toEqual(['big.jpg: файл больше 20 МБ']);
  });
});

describe('formatMb и plural', () => {
  it('форматирует размер через запятую', () => {
    expect(formatMb(1.2 * MB)).toBe('1,2 МБ');
    expect(formatMb(5 * MB)).toBe('5 МБ');
    expect(formatMb(10)).toBe('0,1 МБ');
    expect(formatMb(undefined)).toBe('— МБ');
  });

  it('склоняет «файл»', () => {
    const forms = ['файл', 'файла', 'файлов'] as const;
    expect(plural(1, forms)).toBe('файл');
    expect(plural(2, forms)).toBe('файла');
    expect(plural(4, forms)).toBe('файла');
    expect(plural(5, forms)).toBe('файлов');
    expect(plural(11, forms)).toBe('файлов');
    expect(plural(21, forms)).toBe('файл');
    expect(plural(0, forms)).toBe('файлов');
  });
});

describe('правки по ревью', () => {
  it('документ с типом octet-stream принимается по расширению, а .exe отклоняется', () => {
    const doc = (name: string): PickedFile => ({
      uri: `file:///${name}`,
      name,
      mimeType: 'application/octet-stream',
      size: MB,
      kind: 'document',
    });
    expect(validateFile(doc('act.docx'))).toBeNull();
    expect(validateFile(doc('act.pdf'))).toBeNull();
    expect(validateFile(doc('virus.exe'))).toBe('virus.exe: такой тип файла не поддерживается');
  });

  it('в сообщении про лимит «из N» считаются все выбранные, а не только подошедшие', () => {
    const files = [
      image('big.jpg', 30 * MB),
      ...['a', 'b', 'c', 'd'].map((n) => image(`${n}.jpg`)),
    ];
    const plan = planAdd(files, 8);
    expect(plan.messages).toEqual([
      'big.jpg: файл больше 20 МБ',
      'Добавлено 2 из 5: максимум 10 вложений',
    ]);
  });
});
