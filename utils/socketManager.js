// Socket.io 관리자
let io = null;

export const initializeSocket = async (server) => {
  if (io) return io;

  try {
    const { Server } = await import('socket.io');
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      console.log(`✅ [Socket] Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        console.log(`✅ [Socket] Client disconnected: ${socket.id}`);
      });
    });

    console.log('✅ Socket.io initialized');
    return io;
  } catch (error) {
    console.error('❌ Socket.io initialization error:', error);
    return null;
  }
};

export const getIO = () => {
  return io;
};

export const emitReservationUpdate = (data) => {
  if (!io) {
    console.warn('⚠️ Socket.io not initialized');
    return;
  }
  
  io.emit('reservationUpdate', data);
  console.log(`🎯 [Socket] Reservation update emitted for roomId=${data.roomId} (${data.date} ${data.startTime}~${data.endTime})`);
};

