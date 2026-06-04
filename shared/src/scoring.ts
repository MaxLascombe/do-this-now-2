export const computePoints = (
  done: number,
  todo: number,
  lives: number,
): number => {
  const doneUsingAllLives = Math.min(done, todo - lives)
  const doneUsingLives = Math.min(done, todo)
  return (
    doneUsingAllLives +
    (doneUsingLives - doneUsingAllLives) * 2 +
    (done - doneUsingLives) * 3
  )
}
