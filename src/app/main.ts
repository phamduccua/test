import './styles/app.css'
import { freeLabModule } from '../lab/index'
import { mountCaption } from './caption'
import { devScene } from './devScene'
import { createHost } from './host'

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')
root.replaceChildren()
root.className = 'fixed inset-0'
const host = createHost(root)
mountCaption(root)
// ?scene=dev: cảnh thử kit (chặng 0); mặc định: phòng lab.
void host.run(new URLSearchParams(location.search).get('scene') === 'dev' ? devScene : freeLabModule)
if (import.meta.env.DEV) Object.assign(window, { __host: host })
