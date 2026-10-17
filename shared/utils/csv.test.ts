import { escapeCsvCell, toCsv } from './csv';

describe('csv utils', () => {
  it('neutralises spreadsheet formula triggers', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
  });

  it('keeps plain negative numbers numeric', () => {
    expect(escapeCsvCell('-5.00')).toBe('-5.00');
  });

  it('quotes delimiters, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('builds a header plus rows', () => {
    expect(toCsv(['A', 'B'], [['1', 'x,y']])).toBe('A,B\n1,"x,y"');
  });
});
