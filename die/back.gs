/**
 * BACKEND - Apps Script
 * Manejo de usuarios, login, vacaciones y ausencias
 */

/**
 * Adapter genérico para llamadas desde google.script.run
 */
function backendAdapter(funcName, ...args) {
  try {
    if (typeof this[funcName] !== "function") {
      throw new Error("Función no encontrada: " + funcName);
    }

    const result = this[funcName](...args);
    return JSON.stringify({ ok: true, data: result });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

/** ================================
 * LOGIN
 * ================================= */
function validarLogin(email, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const passSheet = ss.getSheetByName("passwords");
  const usersSheet = ss.getSheetByName("users");

  try {
    const passData = passSheet.getDataRange().getValues();
    const usersData = usersSheet.getDataRange().getValues();

    const emailCol = passData[0].indexOf("user_login_mail");
    const passCol = passData[0].indexOf("user_login_password");
    const idColPass = passData[0].indexOf("user_id");

    const idColUsers = usersData[0].indexOf("user_id");
    const rolCol = usersData[0].indexOf("user_position");

    const fila = passData.find(row => row[emailCol] === email);
    if (!fila) return { estado: "ERROR", mensaje: "Usuario no encontrado" };

    const userId = fila[idColPass];
    const passCorrecta = fila[passCol];
    if (pass !== passCorrecta) return { estado: "ERROR", mensaje: "Contraseña incorrecta" };

    const userFila = usersData.find(row => row[idColUsers] === userId);
    if (!userFila) return { estado: "ERROR", mensaje: "Usuario no existe en users" };

    const rol = userFila[rolCol];
    return { estado: "OK", rol: rol, user_id: userId };

  } catch (error) {
    console.error("Error en validarLogin:", error);
    return { estado: "ERROR", mensaje: error.message };
  }
}

function registrarLog(userId, ip) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("logs");

  // 1. Obtener datos del usuario desde la hoja "users"
  const user = getUserById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado con ID: " + userId);
  }

  // 2. Generar log_id único
  const logId = Utilities.getUuid();

  // 3. Fecha/hora actual en formato dd/MM HH:mm
  const logDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM HH:mm");

  // 4. Geolocalización por IP (ip-api.com)
  let logUbication = "Desconocida";
  try {
    const url = "http://ip-api.com/json/" + ip;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    if (data && data.status === "success") {
      logUbication = data.city + ", " + data.regionName + ", " + data.country;
    }
  } catch (err) {
    Logger.log("Error obteniendo geolocalización: " + err);
  }

  // 5. Registrar fila en la hoja "logs"
  sheet.appendRow([
    user.user_id,   // user_id
    logId,          // log_id
    user.user_name, // user_name
    user.user_team, // user_team
    user.user_leader, // user_leader
    logDate,        // log_date
    logUbication,   // log_ubication
    ip              // log_ip
  ]);
}


/** ================================
 * HELPERS
 * ================================= */
function getUserById(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("users");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idIdx = headers.indexOf("user_id");
  const row = data.find(r => r[idIdx] === userId);
  if (!row) return null;

  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

/**
 * Verifica si una fecha es lunes
 */
function esLunes(fecha) {
  return fecha.getDay() === 0; // 0 = Lunes
}

/**
 * Obtiene el lunes de la semana de una fecha dada
 */
function getLunesDelaSemana(fecha) {
  const dia = fecha.getDay();
  const diasHastaLunes = dia === 0 ? -6 : 1 - dia; // Si es domingo, retroceder 6 días
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diasHastaLunes);
  return lunes;
}

/**
 * Obtiene el domingo de la semana de una fecha dada
 */
function getDomingoDelaSemana(fecha) {
  const lunes = getLunesDelaSemana(fecha);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return domingo;
}

/**
 * Verifica si un mes/año está habilitado para vacaciones
 */
function esMesHabilitado(fecha) {
  const año = fecha.getFullYear();
  const mes = fecha.getMonth() + 1; // getMonth() retorna 0-11
  
  // 2025: Octubre y Diciembre
  if (año === 2025) {
    return mes === 10 || mes === 12;
  }
  
  // 2026: Enero, Febrero, Marzo, Abril, Junio, Julio, Agosto
  if (año === 2026) {
    return [1, 2, 3, 4, 6, 7, 8].includes(mes);
  }
  
  return false;
}

/**
 * Calcula días de vacaciones ya solicitados por un usuario
 */
function getDiasVacacionesUsuario(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vacSheet = ss.getSheetByName("vacations");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const userIdCol = headers.indexOf("user_id");
  const initCol = headers.indexOf("vacation_init_date");
  const endCol = headers.indexOf("vacation_end_date");

  const vacacionesUsuario = data.filter(r => r[userIdCol] === userId);
  
  let totalDias = 0;
  vacacionesUsuario.forEach(row => {
    const inicio = new Date(row[initCol]);
    const fin = new Date(row[endCol]);
    const diferencia = (fin - inicio) / (1000 * 60 * 60 * 24) + 1; // +1 para incluir ambos días
    totalDias += diferencia;
  });
  
  return totalDias;
}

/**
 * Obtiene todas las vacaciones del equipo de un usuario
 */
function getVacacionesDelEquipo(userTeam, excludeUserId = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vacSheet = ss.getSheetByName("vacations");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const userIdCol = headers.indexOf("user_id");
  const teamCol = headers.indexOf("user_team");
  const initCol = headers.indexOf("vacation_init_date");
  const endCol = headers.indexOf("vacation_end_date");

  return data
    .filter(r => r[teamCol] === userTeam && r[userIdCol] !== excludeUserId)
    .map(r => ({
      user_id: r[userIdCol],
      vacation_init_date: new Date(r[initCol]),
      vacation_end_date: new Date(r[endCol])
    }));
}

/**
 * Verifica si hay conflicto con vacaciones del mismo equipo
 */
function hayConflictoEquipo(userTeam, fechaInicio, fechaFin, excludeUserId = null) {
  const vacacionesEquipo = getVacacionesDelEquipo(userTeam, excludeUserId);
  
  for (let vacacion of vacacionesEquipo) {
    // Verificar solapamiento de fechas
    if (fechaInicio <= vacacion.vacation_end_date && fechaFin >= vacacion.vacation_init_date) {
      return true;
    }
  }
  
  return false;
}

/**
 * Función principal de validación de vacaciones
 */
function validarVacacion(userId, initDate, endDate) {
  try {
    const user = getUserById(userId);
    if (!user) {
      return { estado: "ERROR", mensaje: "Usuario no encontrado" };
    }

    const fechaInicio = new Date(initDate);
    const fechaFin = new Date(endDate);
    
    // 1. Verificar que la fecha de inicio sea un lunes
    if (!esLunes(fechaInicio)) {
      return { estado: "ERROR", mensaje: "Las vacaciones solo pueden comenzar un día lunes" };
    }
    
    // 2. Verificar que el mes de inicio esté habilitado
    if (!esMesHabilitado(fechaInicio)) {
      const año = fechaInicio.getFullYear();
      const mesesHabilitados = año === 2025 ? "octubre y diciembre" : "enero, febrero, marzo, abril, junio, julio y agosto";
      return { estado: "ERROR", mensaje: `El mes de inicio debe ser uno de los meses habilitados para ${año}: ${mesesHabilitados}` };
    }
    
    // 3. Calcular días solicitados
    const diasSolicitados = (fechaFin - fechaInicio) / (1000 * 60 * 60 * 24) + 1;
    
    // 4. Verificar que sean bloques válidos (7 o 14 días)
    if (diasSolicitados !== 7 && diasSolicitados !== 14) {
      return { estado: "ERROR", mensaje: "Solo se permiten bloques de 7 días (1 semana) o 14 días (2 semanas)" };
    }
    
    // 5. Verificar que termine en domingo
    const domingoEsperado = new Date(fechaInicio);
    domingoEsperado.setDate(fechaInicio.getDate() + diasSolicitados - 1);
    
    if (fechaFin.getTime() !== domingoEsperado.getTime()) {
      return { estado: "ERROR", mensaje: "Las vacaciones deben terminar en domingo. Para este lunes, debería terminar el " + domingoEsperado.toLocaleDateString() };
    }
    
    // 6. Verificar límite de días anuales (14 días máximo)
    const diasYaUsados = getDiasVacacionesUsuario(userId);
    if (diasYaUsados + diasSolicitados > 14) {
      const diasDisponibles = 14 - diasYaUsados;
      return { estado: "ERROR", mensaje: `Excede el límite anual de 14 días. Ya has usado ${diasYaUsados} días, solo te quedan ${diasDisponibles} días disponibles` };
    }
    
    // 7. Verificar conflictos con el mismo equipo
    if (hayConflictoEquipo(user.user_team, fechaInicio, fechaFin, userId)) {
      return { estado: "ERROR", mensaje: "Ya hay alguien de tu equipo con vacaciones en esas fechas. Elige otras fechas." };
    }
    
    return { estado: "OK", mensaje: "Vacación válida" };
    
  } catch (error) {
    console.error("Error en validarVacacion:", error);
    return { estado: "ERROR", mensaje: "Error interno: " + error.message };
  }
}

/** ================================
 * USUARIOS
 * ================================= */
function getAllUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("users");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

function createUser(userData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("users");
  const userId = Utilities.getUuid();

  try {
    sheet.appendRow([
      userId,
      userData.user_name,
      userData.user_team,
      userData.user_leader,
      userData.user_position
    ]);
    return { estado: "OK", user_id: userId };
  } catch (err) {
    console.error("Error en createUser:", err);
    return { estado: "ERROR", mensaje: err.message };
  }
}

function updateUser(userId, userData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("users");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idIdx = headers.indexOf("user_id");
  const rowIndex = data.findIndex(r => r[idIdx] === userId);
  if (rowIndex === -1) return { estado: "ERROR", mensaje: "Usuario no encontrado" };

  const rowNumber = rowIndex + 2; // +1 header, +1 index base 1
  headers.forEach((h, i) => {
    if (userData[h] !== undefined) sheet.getRange(rowNumber, i + 1).setValue(userData[h]);
  });

  return { estado: "OK" };
}

function deleteUser(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("users");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idIdx = headers.indexOf("user_id");
  const rowIndex = data.findIndex(r => r[idIdx] === userId);
  if (rowIndex === -1) return { estado: "ERROR", mensaje: "Usuario no encontrado" };

  sheet.deleteRow(rowIndex + 2);
  return { estado: "OK" };
}

function getVacacionesEquipo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vacSheet = ss.getSheetByName("vacations");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const userNameCol = headers.indexOf("user_name");
  const initCol = headers.indexOf("vacation_init_date");
  const endCol = headers.indexOf("vacation_end_date");

  return data.map(r => ({
    user_name: r[userNameCol],
    vacation_init_date: r[initCol],
    vacation_end_date: r[endCol]
  }));
}

/**
 * Obtener lista de equipos disponibles
 */
function getEquiposDisponibles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName("users");
  const data = usersSheet.getDataRange().getValues();
  const headers = data.shift();
  
  const teamCol = headers.indexOf("user_team");
  const equipos = [...new Set(data.map(row => row[teamCol]).filter(team => team))];
  
  return equipos.sort();
}

/**
 * Verificar si el usuario es Supervisor o PM
 */
function esUsuarioPrivilegiado(userId) {
  const user = getUserById(userId);
  if (!user) return false;
  
  return user.user_position === "Supervisor" || user.user_position === "PM";
}

/** ================================
 * VACACIONES
 * ================================= */
function agregarVacacionBackend(userId, initDate, endDate) {
  try {
    // Primero validar la vacación
    const validacion = validarVacacion(userId, initDate, endDate);
    if (validacion.estado === "ERROR") {
      return validacion.mensaje; // Retorna el mensaje de error específico
    }
    
    // Si la validación es exitosa, proceder a guardar
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const vacSheet = ss.getSheetByName("vacations");
    const user = getUserById(userId);
    
    const vacationId = Utilities.getUuid();

    vacSheet.appendRow([
      user.user_id,
      vacationId,
      user.user_name,
      user.user_team,
      user.user_leader,
      initDate,
      endDate
    ]);
    
    return "OK";
    
  } catch (err) {
    console.error("Error en agregarVacacionBackend:", err);
    return "Error interno al guardar la vacación";
  }
}

function getVacacionesUsuario(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vacSheet = ss.getSheetByName("vacations");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const userIdCol = headers.indexOf("user_id");
  const vacationIdCol = headers.indexOf("vacation_id");
  const initCol = headers.indexOf("vacation_init_date");
  const endCol = headers.indexOf("vacation_end_date");

  return data.filter(r => r[userIdCol] === userId)
    .map(r => ({
      vacation_id: r[vacationIdCol],
      vacation_init_date: r[initCol],
      vacation_end_date: r[endCol]
    }));
}

function eliminarVacacionBackend(vacationId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vacSheet = ss.getSheetByName("vacations");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const idIdx = headers.indexOf("vacation_id");
  const rowIndex = data.findIndex(r => r[idIdx] === vacationId);
  if (rowIndex === -1) return "ERROR: Vacación no encontrada";

  vacSheet.deleteRow(rowIndex + 2); // +1 header, +1 base 1
  return "OK";
}

/**
 * Obtener vacaciones filtradas según el rol del usuario
 */
function getVacacionesFiltradas(userId, filtroEquipo = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const vacSheet = ss.getSheetByName("vacations");
  const usersSheet = ss.getSheetByName("users");
  
  const vacData = vacSheet.getDataRange().getValues();
  const vacHeaders = vacData.shift();
  
  const usersData = usersSheet.getDataRange().getValues();
  const usersHeaders = usersData.shift();
  
  const userNameColVac = vacHeaders.indexOf("user_name");
  const userTeamColVac = vacHeaders.indexOf("user_team");
  const initColVac = vacHeaders.indexOf("vacation_init_date");
  const endColVac = vacHeaders.indexOf("vacation_end_date");
  
  const userIdColUsers = usersHeaders.indexOf("user_id");
  const userTeamColUsers = usersHeaders.indexOf("user_team");
  const userPositionCol = usersHeaders.indexOf("user_position");
  
  // Obtener información del usuario loggeado
  const usuario = usersData.find(row => row[userIdColUsers] === userId);
  if (!usuario) {
    return [];
  }
  
  const userRole = usuario[userPositionCol];
  const userTeam = usuario[userTeamColUsers];
  
  let vacacionesFiltradas = [];
  
  // Si es Supervisor o PM, puede ver todas o filtrar por equipo
  if (userRole === "Supervisor" || userRole === "PM") {
    if (filtroEquipo && filtroEquipo !== "todos") {
      // Filtrar por equipo específico
      vacacionesFiltradas = vacData.filter(row => row[userTeamColVac] === filtroEquipo);
    } else {
      // Mostrar todas las vacaciones
      vacacionesFiltradas = vacData;
    }
  } else {
    // Usuario normal: solo su equipo
    vacacionesFiltradas = vacData.filter(row => row[userTeamColVac] === userTeam);
  }
  
  return vacacionesFiltradas.map(row => ({
    user_name: row[userNameColVac],
    user_team: row[userTeamColVac],
    vacation_init_date: row[initColVac],
    vacation_end_date: row[endColVac]
  }));
}

/** ================================
 * AUSENCIAS
 * ================================= */
function agregarAusenciaBackend(userId, motivo, fecha) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ausSheet = ss.getSheetByName("absences");
  const user = getUserById(userId);
  if (!user) return "ERROR: Usuario no encontrado";

  const ausenciaId = Utilities.getUuid();

  try {
    ausSheet.appendRow([
      user.user_id,
      ausenciaId,
      user.user_name,
      user.user_team,
      user.user_leader,
      motivo,
      fecha
    ]);
    return "OK";
  } catch (err) {
    console.error("Error en agregarAusenciaBackend:", err);
    return "ERROR";
  }
}

function getAusenciasUsuario(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ausSheet = ss.getSheetByName("absences");
  const data = ausSheet.getDataRange().getValues();
  const headers = data.shift();

  const userIdCol = headers.indexOf("user_id");
  const ausenciaIdCol = headers.indexOf("absence_id");
  const motivoCol = headers.indexOf("absence_reason");
  const fechaCol = headers.indexOf("absence_date");

  return data.filter(r => r[userIdCol] === userId)
    .map(r => ({
      absence_id: r[ausenciaIdCol],
      absence_reason: r[motivoCol],
      absence_date: r[fechaCol]
    }));
}