/** 对应 ui_widgets.Button */
export class Button {
  constructor(rect, text, options = {}) {
    this.rect = rect;
    this.text = text;
    this.bg = options.bg ?? '#1e1e1e';
    this.fg = options.fg ?? '#ffffff';
    this.hoverBg = options.hoverBg ?? '#3c3c3c';
    this.border = options.border ?? '#ffffff';
    this.borderWidth = options.borderWidth ?? 2;
    this.radius = options.radius ?? 10;
    this.font = options.font ?? '36px sans-serif';
    this._hovered = false;
  }

  contains(x, y) {
    const { x: rx, y: ry, w, h } = this.rect;
    return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
  }

  setHovered(hovered) {
    this._hovered = hovered;
  }

  draw(ctx) {
    const { x, y, w, h } = this.rect;
    const bg = this._hovered ? this.hoverBg : this.bg;
    ctx.save();
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, this.radius);
    ctx.fill();
    if (this.borderWidth > 0) {
      ctx.strokeStyle = this.border;
      ctx.lineWidth = this.borderWidth;
      roundRect(ctx, x, y, w, h, this.radius);
      ctx.stroke();
    }
    ctx.fillStyle = this.fg;
    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, x + w / 2, y + h / 2);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
