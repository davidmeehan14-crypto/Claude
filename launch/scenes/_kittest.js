KIT.addScene({ name: 'test', start: 0, end: 45, draw(ctx, t) {
  const K = KIT, C = K.C;
  K.bgMesh(ctx, t);
  K.OBJECTS.forEach((n, i) => K.obj(ctx, n, 160 + (i % 5) * 180, 180 + Math.floor(i / 5) * 200, 150, { rot: .1 }));
  K.ICONS.forEach((n, i) => K.icon(ctx, n, 120 + i * 46, 1030, 30, C.ink, 1.8));
  K.phone(ctx, { x: 1350, y: 540, h: 820, yaw: .15 }, (g) => { g.fillStyle = C.cream; g.fillRect(0, 0, 390, 844); K.UI.statusBar(g); K.UI.text(g, 'Sophie & James', 24, 110, 28, 800); K.UI.ring(g, 300, 200, 50, .68); K.UI.card(g, 20, 300, 350, 120); K.UI.avatar(g, 60, 360, 22, 'SJ', C.blush); K.UI.bar(g, 100, 380, 240, 10, .7); K.UI.pill(g, 'Attending', 110, 340, { bg: '#E3F5EA' }); K.UI.check(g, 330, 345, 12, 1); K.UI.tabBar(g, 0); });
  const L = K.layout(ctx, [{ text: 'Every ', size: 84, weight: 600 }, { text: 'love story', size: 90, weight: 400, family: K.F.serif, style: 'italic', grad: [C.gold, C.rose] }]);
  K.drawLine(ctx, L, 520, 700, null);
  K.logo(ctx, 520, 860, 420);
  K.touch(ctx, 1300, 700, 0, { ripple: .4 });
  K.glass(ctx, 900, 60, 300, 90); K.UI.text(ctx, 'Who still needs to RSVP?', 925, 115, 22, 600);
}});
