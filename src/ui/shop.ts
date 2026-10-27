// The Magician's table: the one upgrade menu (CLAUDE.md → Allowed, but keep it minimal). A list of parts, their
// price in pentacles, and whether you can take them. Esc or E closes it.
import { canBuy, type SaveData, type ShopItem } from '../core/save';

export class Shop {
  private el: HTMLDivElement;
  private list: HTMLElement;
  private purse: HTMLElement;
  private line: HTMLElement;
  open = false;
  onBuy: (item: ShopItem) => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'overlay shop hidden';
    this.el.innerHTML = `
      <h1>The Magician</h1>
      <p class="line"></p>
      <div class="purse"></div>
      <div class="items"></div>
      <button data-a="close" class="small">Leave the table (Esc)</button>`;
    document.body.appendChild(this.el);
    this.list = this.el.querySelector('.items')!;
    this.purse = this.el.querySelector('.purse')!;
    this.line = this.el.querySelector('.line')!;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.a === 'close') this.close();
    });
  }

  /** Open for whoever keeps it: the Magician's table, or (after the Tower) the Star's pool. */
  show(save: SaveData, items: readonly ShopItem[], line: string, keeper = 'The Magician') {
    this.open = true;
    this.el.querySelector('h1')!.textContent = keeper;
    this.line.textContent = line;
    this.render(save, items);
    this.el.classList.remove('hidden');
  }

  render(save: SaveData, items: readonly ShopItem[]) {
    this.purse.textContent = `✪ ${save.pentacles} pentacles`;
    this.list.innerHTML = '';
    for (const item of items) {
      const can = canBuy(save, item);
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<div><b></b><span></span></div><button class="small"></button>`;
      row.querySelector('b')!.textContent = item.name;
      row.querySelector('span')!.textContent = item.blurb;
      const btn = row.querySelector('button')!;
      btn.textContent = can.reason === 'owned' ? 'Owned' : `✪ ${item.price}`;
      btn.disabled = !can.ok;
      if (!can.ok && can.reason !== 'owned') btn.title = can.reason ?? '';
      if (!can.ok && can.reason && can.reason !== 'owned') row.querySelector('span')!.textContent += ` (${can.reason})`;
      btn.addEventListener('click', () => {
        if (canBuy(save, item).ok) this.onBuy(item);
      });
      btn.dataset.item = item.id;
      this.list.appendChild(row);
    }
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.onClose();
  }
}
