export class Point {
  constructor(row, col) {
    this.row = row;
    this.col = col;
  }

  copy() {
    return new Point(this.row, this.col);
  }

  equals(other) {
    return this.row === other.row && this.col === other.col;
  }
}
