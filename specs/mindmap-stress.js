// Stress test for the mindmap type: a big generated map (8 branches × 6 ideas × 4 sub-ideas,
// some a level deeper) with a note on every idea. Not a teaching example.
(() => {
  const topics = ['Planning', 'Design', 'Building', 'Testing', 'Shipping', 'People', 'Money', 'Risks'];
  const lines = ['- Big project'];
  const notes = { 'Big project': 'The centre of a large generated map, used to test size, collapsing and notes.' };
  topics.forEach((t) => {
    lines.push(`  - ${t}`);
    notes[t] = `Everything about ${t.toLowerCase()}: six ideas, each with four sub-ideas.`;
    for (let i = 1; i <= 6; i++) {
      const idea = `${t} idea ${i}`;
      lines.push(`    - ${idea}`);
      notes[idea] = `Idea ${i} under ${t}. A note can be a few sentences long, e.g. why it matters and what to do next.`;
      for (let j = 1; j <= 4; j++) {
        const sub = `${t} ${i}.${j}`;
        lines.push(`      - ${sub}`);
        if (i === 1 && j === 1) {
          lines.push(`        - ${t} ${i}.${j} detail A`);
          lines.push(`        - ${t} ${i}.${j} detail B`);
        }
      }
    }
  });

  window.VIZ = {
    title: "Mind map stress test",
    subtitle: `${lines.length} ideas, 4 levels deep`,
    scene: { map: { type: "mindmap", outline: lines.join('\n'), notes } },
    steps: [
      { say: "The centre.", do: [{ focus: "map", at: "Big project" }] },
      ...topics.slice(0, 4).map((t) => ({ say: `Grow ${t}.`, do: [{ grow: "map", at: t, deep: true }] })),
      { say: "Grow the rest.", do: topics.slice(4).map((t) => ({ grow: "map", at: t, deep: true })) },
      { say: "Focus deep inside one branch.", do: [{ focus: "map", at: "Risks 6.4" }] },
      { say: "Everything.", do: [{ focus: "map", at: null }] }
    ]
  };
})();
