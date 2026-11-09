import './styles/app.css'
import { freeLabModule } from '../lab/index'
import { mountUi } from '../ui/index'
import { devScene } from './devScene'
import { createHost } from './host'

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')
root.replaceChildren()
root.className = 'fixed inset-0'
const host = createHost(root)
const q = new URLSearchParams(location.search)
// ?scene=dev: cảnh thử kit (chặng 0); mặc định: phòng lab. ?mode=ui: giao diện với dữ liệu mẫu; ?mode=showroom: phòng trưng bày.
const mode = q.get('mode')
if (mode !== 'showroom' && q.get('scene') !== 'dev') mountUi(root, host, mode)
void host.run(q.get('scene') === 'dev' ? devScene : freeLabModule)
if (import.meta.env.DEV) Object.assign(window, { __host: host })
