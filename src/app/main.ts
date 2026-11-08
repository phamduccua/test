import './styles/app.css'
import { mountCaption } from './caption'
import { devScene } from './devScene'
import { createHost } from './host'

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')
root.replaceChildren()
root.className = 'fixed inset-0'
const host = createHost(root)
mountCaption(root)
void host.run(devScene)
if (import.meta.env.DEV) Object.assign(window, { __host: host })
