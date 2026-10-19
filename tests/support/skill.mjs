// Reading a skill's markdown by its numbered steps (`## <n>. Title`).

/** The body of step `n` of `text`: everything after its `## <n>. ` heading up to the next `## ` heading. */
export const stepOf = (text, n) =>
  new RegExp(`^## ${n}\\. .*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text)?.[1] ?? '';
