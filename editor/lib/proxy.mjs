/**
 * 代理自动探测。
 *
 * 来源优先级：常见端口 > 环境变量 > Windows 系统代理 > Clash 配置文件
 * 验证方式：真的向代理发一次 CONNECT github.com:443，返回 200 才算可用。
 * 结果缓存 5 分钟，发布失败时会强制重新探测。
 */
import net from 'node:net'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// 常见代理客户端的默认端口，Clash Verge 用 7897，Clash for Windows 用 7890
const COMMON_PORTS = [7897, 7890, 7891, 7892, 2080, 20171, 10808, 10809, 1080, 8888, 8080, 33210]

export const PROXY_ENV_KEYS = [
  'http_proxy',
  'https_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'all_proxy',
  'ALL_PROXY',
]

const TTL = 5 * 60 * 1000
let cache = { port: null, at: 0 }

/** 通过代理建一条到 github.com:443 的隧道，能建立就算可用 */
function testProxy(port, host = 'github.com', timeout = 2500) {
  return new Promise((resolve) => {
    let settled = false
    const socket = net.createConnection({ host: '127.0.0.1', port })

    const finish = (ok) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }

    socket.setTimeout(timeout)
    socket.on('connect', () => {
      socket.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`)
    })
    socket.on('data', (chunk) => {
      // 代理应答的第一行类似 "HTTP/1.1 200 Connection Established"
      finish(/^HTTP\/1\.[01] 200/.test(chunk.toString('latin1')))
    })
    socket.on('timeout', () => finish(false))
    socket.on('error', () => finish(false))
  })
}

function clashConfigPaths() {
  const home = os.homedir()
  return [
    path.join(home, 'AppData', 'Roaming', 'io.github.clash-verge-rev.clash-verge-rev', 'clash-verge.yaml'),
    path.join(home, 'AppData', 'Roaming', 'io.github.clash-verge-rev.clash-verge-rev', 'config.yaml'),
    path.join(home, 'AppData', 'Local', 'io.github.clash-verge-rev.clash-verge-rev', 'clash-verge.yaml'),
    path.join(home, '.config', 'clash', 'config.yaml'),
    path.join(home, '.config', 'clash-verge', 'config.yaml'),
  ]
}

async function collectCandidates() {
  const ports = new Set(COMMON_PORTS)

  // 1. 环境变量里已有的代理
  for (const key of PROXY_ENV_KEYS) {
    const match = /(?:127\.0\.0\.1|localhost):(\d{2,5})/.exec(process.env[key] || '')
    if (match) ports.add(Number(match[1]))
  }

  // 2. Windows 系统代理设置（Clash 开启「系统代理」时会写在这里）
  try {
    const { stdout } = await execFileAsync(
      'reg',
      [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        '/v',
        'ProxyServer',
      ],
      { windowsHide: true }
    )
    for (const match of stdout.matchAll(/(?:127\.0\.0\.1|localhost):(\d{2,5})/g)) {
      ports.add(Number(match[1]))
    }
  } catch {
    /* 非 Windows 或未设置 */
  }

  // 3. Clash 配置文件里声明的端口
  for (const file of clashConfigPaths()) {
    try {
      const text = await fs.readFile(file, 'utf8')
      for (const match of text.matchAll(/^(?:mixed-port|port|socks-port):\s*(\d{2,5})/gm)) {
        ports.add(Number(match[1]))
      }
    } catch {
      /* 文件不存在，跳过 */
    }
  }

  return [...ports]
}

/**
 * 返回可用的代理端口；没有可用代理时返回 null。
 * force=true 时忽略缓存，重新探测。
 */
export async function detectProxy({ force = false } = {}) {
  if (!force && Date.now() - cache.at < TTL) return cache.port

  const ports = await collectCandidates()
  const results = await Promise.all(
    ports.map(async (port) => ({ port, ok: await testProxy(port) }))
  )
  const hit = results.find((item) => item.ok)

  cache = { port: hit ? hit.port : null, at: Date.now() }
  return cache.port
}

/** 供 git 使用：清掉环境里可能存在的失效代理，再按需注入 */
export function buildGitEnv(port) {
  const env = { ...process.env }
  for (const key of PROXY_ENV_KEYS) delete env[key]

  if (port) {
    const url = `http://127.0.0.1:${port}`
    env.http_proxy = url
    env.https_proxy = url
    env.HTTP_PROXY = url
    env.HTTPS_PROXY = url
  }

  return env
}
