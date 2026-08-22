/**
 * Split a .sql file into individual statements.
 *
 * Neon's HTTP driver executes one statement per round trip, so schema.sql has to
 * be broken up. A naive split on ";" would cut through function bodies, so this
 * tracks single-quoted strings, line comments and $$-quoted blocks.
 */
export function splitStatements(sqlText) {
  const statements = [];
  let current = '';
  let i = 0;

  while (i < sqlText.length) {
    const char = sqlText[i];

    if (char === '-' && sqlText[i + 1] === '-') {
      const end = sqlText.indexOf('\n', i);
      i = end === -1 ? sqlText.length : end;
      continue;
    }

    if (char === "'") {
      const end = findClosingQuote(sqlText, i);
      current += sqlText.slice(i, end);
      i = end;
      continue;
    }

    if (char === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sqlText.slice(i))?.[0];
      if (tag) {
        const close = sqlText.indexOf(tag, i + tag.length);
        const end = close === -1 ? sqlText.length : close + tag.length;
        current += sqlText.slice(i, end);
        i = end;
        continue;
      }
    }

    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function findClosingQuote(text, start) {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "'") {
      if (text[i + 1] === "'") {
        i += 2; // escaped quote
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return text.length;
}
