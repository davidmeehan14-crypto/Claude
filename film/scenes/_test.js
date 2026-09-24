FILM.addScene({ name: 'test', start: 0, end: 60, draw(ctx, t) {
  const F = FILM; F.paper(ctx);
  F.drawDot(ctx, { x: 500, y: 760, t, mood: 'neutral', blush: .6 });
  F.drawDash(ctx, { x: 800, y: 760, t, mood: 'happy', armR: [40, -60], mouth: .6 });
  F.drawBiscuit(ctx, { x: 1100, y: 760, t, tongue: true });
  F.drawDot(ctx, { x: 1400, y: 760, t, mood: 'love', mouth: .5 });
  F.drawDash(ctx, { x: 1650, y: 760, t, mood: 'panic', kneel: 1, armL: [-50, -80] });
  F.drawDot(ctx, { x: 300, y: 1000, t, mood: 'worried', scale: .8 });
  F.drawDot(ctx, { x: 500, y: 1000, t, mood: 'joy', scale: .8, walk: t });
  F.drawDot(ctx, { x: 700, y: 1000, t, mood: 'shock', scale: .8 });
  F.drawDot(ctx, { x: 900, y: 1000, t, mood: 'shy', scale: .8, blush: 1 });
  F.chapterCaption(ctx, 'Chapter Two.|The first date.', 1.2);
  F.heart(ctx, 1200, 300, 90); F.sparkle(ctx, 1400, 300, 40);
  F.confetti(ctx, t, 0, { x: 1600, y: 500 });
}});
