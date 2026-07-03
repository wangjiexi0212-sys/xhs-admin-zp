const API_WORKER = 'https://xhs-admin-api.xhs-admin.workers.dev'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const target = `${API_WORKER}${url.pathname}${url.search}`

  const req = new Request(target, {
    method: context.request.method,
    headers: context.request.headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
  })

  return fetch(req)
}
