/**
 * BACKEND - Apps Script
 * Manejo de usuarios, login, vacaciones y ausencias
 */

function prueba(){
  Logger.log(getUserById(2))
}

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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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

function getUrlValidadLog() {
  const url = "https://api.ipify.org?format=json";
  return url;
}

function registrarLog(userId, ip) {
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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

/** ================================
 * USUARIOS
 * ================================= */
function getAllUsers() {
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
  const sheet = ss.getSheetByName("users");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idIdx = headers.indexOf("user_id");
  const rowIndex = data.findIndex(r => r[idIdx] === userId);
  if (rowIndex === -1) return { estado: "ERROR", mensaje: "Usuario no encontrado" };

  sheet.deleteRow(rowIndex + 2);
  return { estado: "OK" };
}

/**
 * Obtener lista de equipos disponibles
 */
function getEquiposDisponibles() {
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
 * FUNCIONES PARA CALENDARIO DE VACACIONES
 * ================================= */

/**
 * Obtiene información de usuario para mostrar en el header
 */
function getUserHeaderInfo(userId) {
  try {
    const user = getUserById(userId);
    if (!user) {
      return { estado: "ERROR", mensaje: "Usuario no encontrado" };
    }
    
    // Determinar saludo según la hora
    const now = new Date();
    const hora = now.getHours();
    let saludo;
    
    if (hora >= 5 && hora < 12) {
      saludo = "Buen día";
    } else if (hora >= 12 && hora < 18) {
      saludo = "Buenas tardes";
    } else {
      saludo = "Buenas noches";
    }
    
    return {
      estado: "OK",
      data: {
        user_name: user.user_name,
        user_team: user.user_team,
        user_position: user.user_position,
        saludo: saludo
      }
    };
  } catch (error) {
    console.error("Error en getUserHeaderInfo:", error);
    return { estado: "ERROR", mensaje: error.message };
  }
}

/** ================================
 * FUNCIONES DE UTILIDAD
 * ================================= */

/**
 * Formatea fechas para mostrar en el frontend
 */
function formatearFecha(fecha, formato = "dd/MM/yyyy") {
  try {
    return Utilities.formatDate(new Date(fecha), Session.getScriptTimeZone(), formato);
  } catch (error) {
    return fecha;
  }
}

/**
 * Calcula días hábiles entre dos fechas (excluyendo fines de semana)
 */
function calcularDiasHabiles(fechaInicio, fechaFin) {
  try {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    let diasHabiles = 0;
    
    const fechaActual = new Date(inicio);
    while (fechaActual <= fin) {
      const diaSemana = fechaActual.getDay();
      // 1 = Lunes, 2 = Martes, ..., 5 = Viernes
      if (diaSemana >= 1 && diaSemana <= 5) {
        diasHabiles++;
      }
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    return diasHabiles;
  } catch (error) {
    return 0;
  }
}
