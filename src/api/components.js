import { request } from './request'

export const getComponents = () =>
  request('/api/components')

export const updateComponent = (id, path) =>
  request(`/api/components/${id}`, { method: 'PUT', body: { path } })
