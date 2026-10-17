import { useNavigate } from 'react-router-dom'

/** Goes back within the app, or home when the page was opened directly. */
export function useGoBack() {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }
}
