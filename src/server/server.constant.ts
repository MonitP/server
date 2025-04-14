export const SERVER_ERROR_MESSAGES = {
  NOT_FOUND: '서버를 찾을 수 없습니다.',
  ALREADY_EXISTS: '이미 존재하는 서버입니다.',
  INVALID_CREDENTIALS: '유효하지 않은 인증 정보입니다.',
} as const;

export const SERVER_SUCCESS_MESSAGES = {
  CREATED: '서버가 성공적으로 생성되었습니다.',
  UPDATED: '서버가 성공적으로 수정되었습니다.',
  DELETED: '서버가 성공적으로 삭제되었습니다.',
} as const; 