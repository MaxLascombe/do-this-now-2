import { faCube } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const Loading = () => (
  <div role="status" aria-label="Loading" className="mx-auto w-fit">
    <FontAwesomeIcon
      icon={faCube}
      aria-hidden
      className="h-5 w-5 animate-pulse text-gray-300"
    />
  </div>
)
