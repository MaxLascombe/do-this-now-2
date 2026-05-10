import { useState } from 'react'

import { type KeyAction } from '../hooks/useKeyAction'

const Hint = ({
  keyLetter,
  description,
}: {
  keyLetter: string
  description: string
}) => (
  <li>
    <kbd className="mr-2 mb-1 inline-block rounded-full bg-gray-700 px-3 py-1 text-xs leading-5 font-medium text-white">
      {keyLetter}
    </kbd>
    {description}
  </li>
)

const Hints = ({ keyActions }: { keyActions: KeyAction[] }) => {
  const [show, setShow] = useState(false)
  return (
    <>
      {show && (
        <>
          <div className="fixed inset-0 bg-black/75 transition-opacity" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-lg border border-gray-700 bg-gray-900 px-4 pt-5 pb-4 text-left text-sm text-white shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
            <ul className="list-inside pt-1">
              {keyActions.map(({ key, description }) => (
                <Hint key={key} keyLetter={key} description={description} />
              ))}
            </ul>
          </div>
        </>
      )}
      <button
        onClick={() => setShow((s) => !s)}
        className="fixed top-0 right-0 hidden rounded p-2 text-sm text-gray-400 outline-none ring-white ring-offset-1 ring-offset-black focus:z-10 focus:ring md:block"
      >
        (click for shortcut hints)
      </button>
    </>
  )
}

export default Hints
