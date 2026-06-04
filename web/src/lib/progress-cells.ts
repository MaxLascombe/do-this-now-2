// Progress-bar cell model. `tickAt` marks the should-be-here cell; its outline
// shows whether or not the cell is filled, so the "where you're supposed to be"
// marker stays visible when you're on schedule or ahead — not only when behind.
export const cells = (count: number, filledCount: number, tickAt: number) =>
  Array.from({ length: count }).map((_, i) => {
    const filled = i < filledCount
    const isTick = i === tickAt - 1
    return { filled, isTick, key: i }
  })
