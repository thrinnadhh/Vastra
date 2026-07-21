export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface ConnectivityPort {
  getCurrentStatus(): Promise<ConnectivityStatus>;
  subscribe(listener: (status: ConnectivityStatus) => void): () => void;
}

export class OfflineMutationError extends Error {
  public constructor() {
    super('Mutations require an online connection and explicit user action');
    this.name = 'OfflineMutationError';
  }
}

export async function assertMutationOnline(connectivity: ConnectivityPort): Promise<void> {
  if ((await connectivity.getCurrentStatus()) === 'OFFLINE') throw new OfflineMutationError();
}
