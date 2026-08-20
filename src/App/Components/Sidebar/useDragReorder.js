import { useCallback, useRef, useState } from 'react';

/*
 * Hand-rolled reordering.
 *
 * No drag-and-drop library: this needs one axis, one container, and no drop
 * zones, and the smallest of dnd-kit/react-dnd is larger than the whole feature.
 * HTML5 native drag was the other option and is worse here — it cannot be styled
 * during the drag, fires no events over its own source element in some browsers,
 * and brings a drag image nobody asked for.
 *
 * Written for the horizontal tab strip in 6b.2 and made axis-agnostic in 7.1
 * when the strip became a vertical sidebar list. The axis is a parameter rather
 * than a second copy of the hook: everything except which coordinate to read is
 * identical, and the subtle parts — the click-suppression flag, measuring the
 * boxes once at mousedown — are exactly what a copy would get wrong later.
 */

/** Per-axis accessors, so the body of the hook never names x or y. */
const AXES = {
  x: {
    coord: (event) => event.clientX,
    start: (box) => box.left,
    size: (box) => box.width,
  },
  y: {
    coord: (event) => event.clientY,
    start: (box) => box.top,
    size: (box) => box.height,
  },
};

/** Pixels of travel before a mousedown counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/**
 * Which slot the cursor is over, by midpoint.
 *
 * Inclusive of the midpoint itself: with a strict `<`, dropping an item exactly
 * on the centre of the first one fell through to the slot after it. Tab widths
 * happened to make that landing unreachable until the 6.5b spacing pass changed
 * them, which is a poor reason for the behaviour to be undefined.
 */
function indexForPosition(boxes, position, axis) {
  for (let i = 0; i < boxes.length; i += 1) {
    if (position <= axis.start(boxes[i]) + axis.size(boxes[i]) / 2) return i;
  }
  return boxes.length - 1;
}

function moveItem(items, from, to) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * @param {object}   options
 * @param {string[]} options.ids          Current order.
 * @param {Function} options.onReorder    Called with the new order, once, on drop.
 * @param {object}   options.containerRef Element holding the draggable items.
 * @param {'x'|'y'}  [options.axis]       Which way the list runs.
 * @param {string}   [options.itemSelector] How to find the items inside it.
 */
export default function useDragReorder({
  ids,
  onReorder,
  containerRef,
  axis: axisName = 'x',
  itemSelector = '[data-drag-id]',
}) {
  const axis = AXES[axisName] ?? AXES.x;
  const [draggingId, setDraggingId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  /*
   * A drag ends with a mouseup on the item, which the browser then reports as a
   * click. Without this flag, reordering a document would also activate it.
   */
  const suppressClick = useRef(false);

  const onMouseDown = useCallback(
    (event, id) => {
      // Left button only, and never from the close button.
      if (event.button !== 0) return;
      if (event.target.closest?.('.no-drag')) return;

      /*
       * A drag that ends outside a tab produces no click to consume the flag,
       * which would then swallow the next genuine one. Clearing here scopes the
       * suppression to the gesture that set it.
       */
      suppressClick.current = false;

      const container = containerRef.current;
      if (!container) return;

      const from = ids.indexOf(id);
      if (from === -1) return;

      // Measured once, at mousedown: the boxes shift as items are re-styled
      // mid-drag, and re-measuring would make the drop target oscillate.
      const boxes = [...container.querySelectorAll(itemSelector)].map((el) =>
        el.getBoundingClientRect(),
      );

      const startPosition = axis.coord(event);
      let dragging = false;
      let target = from;

      const finish = (commit) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('keydown', onKey);
        setDraggingId(null);
        setDropIndex(null);
        if (!dragging) return;
        suppressClick.current = true;
        if (commit && target !== from) onReorder(moveItem(ids, from, target));
      };

      function onMove(moveEvent) {
        if (!dragging) {
          if (Math.abs(axis.coord(moveEvent) - startPosition) < DRAG_THRESHOLD)
            return;
          dragging = true;
          setDraggingId(id);
        }
        target = indexForPosition(boxes, axis.coord(moveEvent), axis);
        setDropIndex(target);
      }

      function onUp() {
        finish(true);
      }

      function onKey(keyEvent) {
        if (keyEvent.key === 'Escape') finish(false);
      }

      // On window, not the item: the cursor routinely leaves the list mid-drag,
      // and a listener on the element would silently stop tracking.
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('keydown', onKey);
    },
    [ids, onReorder, containerRef, axis, itemSelector],
  );

  /** True once per completed drag; consumed by the item's click handler. */
  const consumeClickSuppression = useCallback(() => {
    const suppressed = suppressClick.current;
    suppressClick.current = false;
    return suppressed;
  }, []);

  return { draggingId, dropIndex, onMouseDown, consumeClickSuppression };
}
