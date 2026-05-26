export type VolumeSummary = {
  name: string
  driver: string
  mountpoint: string
  usedByContainers: string[]
}
