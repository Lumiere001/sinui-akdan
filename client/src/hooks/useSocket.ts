import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types'

export function useSocket() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
    const newSocket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  return { socket, isConnected }
}
