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
    const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
  const vacSheet = ss.getSheetByName("vacations");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const idIdx = headers.indexOf("vacation_id");
  const rowIndex = data.findIndex(r => r[idIdx] === vacationId);
  if (rowIndex === -1) return "ERROR: Vacación no encontrada";

  vacSheet.deleteRow(rowIndex + 2); // +1 header, +1 base 1
  return "OK";
}

function getVacacionesEquipo() {
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
 * Obtener vacaciones filtradas según el rol del usuario
 */
function getVacacionesFiltradas(userId, filtroEquipo = null) {
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
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

/**
 * Valida si una fecha es válida para inicio de vacaciones
 */
function validarFechaInicio(fecha) {
  try {
    const fechaObj = new Date(fecha);
    
    const validaciones = {
      es_lunes: esLunes(fechaObj),
      mes_habilitado: esMesHabilitado(fechaObj),
      es_futura: fechaObj > new Date()
    };
    
    const errores = [];
    if (!validaciones.es_lunes) errores.push("La fecha debe ser un lunes");
    if (!validaciones.mes_habilitado) errores.push("El mes no está habilitado para vacaciones");
    if (!validaciones.es_futura) errores.push("La fecha debe ser futura");
    
    return {
      estado: errores.length === 0 ? "OK" : "ERROR",
      validaciones: validaciones,
      errores: errores,
      mensaje: errores.length === 0 ? "Fecha válida" : errores.join(", ")
    };
  } catch (error) {
    return { estado: "ERROR", mensaje: "Fecha inválida" };
  }
}

/** ================================
 * FUNCIONES PARA MANEJO DE VACACIONES MEJORADAS
 * ================================= */

/**
 * Procesa y valida una solicitud de vacación completa
 */
function procesarSolicitudVacacion(userId, initDate, endDate) {
  try {
    // 1. Validar la vacación
    const validacion = validarVacacion(userId, initDate, endDate);
    if (validacion.estado === "ERROR") {
      return validacion;
    }
    
    // 2. Si es válida, guardar en la base de datos
    const resultado = agregarVacacionBackend(userId, initDate, endDate);
    
    if (resultado === "OK") {
      // 3. Obtener información adicional para la respuesta
      const user = getUserById(userId);
      const diasSolicitados = Math.ceil((new Date(endDate) - new Date(initDate)) / (1000 * 60 * 60 * 24)) + 1;
      const diasRestantes = 14 - getDiasVacacionesUsuario(userId);
      
      return {
        estado: "OK",
        mensaje: "Vacación agregada correctamente",
        data: {
          dias_solicitados: diasSolicitados,
          dias_restantes: diasRestantes,
          usuario: user.user_name
        }
      };
    } else {
      return { estado: "ERROR", mensaje: resultado };
    }
  } catch (error) {
    console.error("Error en procesarSolicitudVacacion:", error);
    return { estado: "ERROR", mensaje: "Error interno al procesar la solicitud" };
  }
}

/**
 * Obtiene el resumen de vacaciones de un usuario
 */
function getResumenVacacionesUsuario(userId) {
  try {
    const user = getUserById(userId);
    if (!user) {
      return { estado: "ERROR", mensaje: "Usuario no encontrado" };
    }
    
    const vacaciones = getVacacionesUsuario(userId);
    const diasUsados = getDiasVacacionesUsuario(userId);
    const diasDisponibles = 14 - diasUsados;
    
    // Procesar vacaciones para incluir más información
    const vacacionesProcesadas = vacaciones.map(v => ({
      ...v,
      vacation_init_date_formatted: Utilities.formatDate(new Date(v.vacation_init_date), Session.getScriptTimeZone(), "dd/MM/yyyy"),
      vacation_end_date_formatted: Utilities.formatDate(new Date(v.vacation_end_date), Session.getScriptTimeZone(), "dd/MM/yyyy"),
      duration_days: Math.ceil((new Date(v.vacation_end_date) - new Date(v.vacation_init_date)) / (1000 * 60 * 60 * 24)) + 1
    }));
    
    return {
      estado: "OK",
      data: {
        usuario: user.user_name,
        vacaciones: vacacionesProcesadas,
        resumen: {
          dias_usados: diasUsados,
          dias_disponibles: diasDisponibles,
          total_anual: 14,
          porcentaje_usado: Math.round((diasUsados / 14) * 100)
        }
      }
    };
  } catch (error) {
    console.error("Error en getResumenVacacionesUsuario:", error);
    return { estado: "ERROR", mensaje: error.message };
  }
}

/**
 * Sugiere fechas de fin automáticamente basado en fecha de inicio
 */
function sugerirFechaFin(fechaInicio) {
  try {
    const inicio = new Date(fechaInicio);
    
    // Verificar que sea lunes
    if (!esLunes(inicio)) {
      return {
        estado: "ERROR",
        mensaje: "La fecha de inicio debe ser un lunes",
        sugerencias: []
      };
    }
    
    // Verificar que esté en mes habilitado
    if (!esMesHabilitado(inicio)) {
      return {
        estado: "ERROR",
        mensaje: "El mes no está habilitado para vacaciones",
        sugerencias: []
      };
    }
    
    // Generar sugerencias
    const sugerencias = [];
    
    // Opción 1: 7 días (1 semana)
    const fin7dias = new Date(inicio);
    fin7dias.setDate(inicio.getDate() + 6); // +6 para llegar al domingo
    
    sugerencias.push({
      dias: 7,
      fecha_fin: fin7dias.toISOString().split('T')[0],
      fecha_fin_formatted: Utilities.formatDate(fin7dias, Session.getScriptTimeZone(), "dd/MM/yyyy"),
      descripcion: "1 semana (7 días)"
    });
    
    // Opción 2: 14 días (2 semanas)
    const fin14dias = new Date(inicio);
    fin14dias.setDate(inicio.getDate() + 13); // +13 para llegar al domingo de la segunda semana
    
    sugerencias.push({
      dias: 14,
      fecha_fin: fin14dias.toISOString().split('T')[0],
      fecha_fin_formatted: Utilities.formatDate(fin14dias, Session.getScriptTimeZone(), "dd/MM/yyyy"),
      descripcion: "2 semanas (14 días)"
    });
    
    return {
      estado: "OK",
      sugerencias: sugerencias,
      mensaje: "Fechas sugeridas generadas correctamente"
    };
    
  } catch (error) {
    console.error("Error en sugerirFechaFin:", error);
    return { estado: "ERROR", mensaje: error.message };
  }
}

/**
 * Obtiene datos procesados para el calendario de vacaciones
 */
function getCalendarData(userId, filtroEquipo = null) {
  try {
    // Obtener vacaciones filtradas
    const vacaciones = getVacacionesFiltradas(userId, filtroEquipo);
    
    // Procesar datos para el calendario
    const calendarData = vacaciones.map(v => ({
      user_name: v.user_name,
      user_team: v.user_team,
      vacation_init_date: v.vacation_init_date,
      vacation_end_date: v.vacation_end_date,
      // Calcular duración en días
      duration_days: Math.ceil((new Date(v.vacation_end_date) - new Date(v.vacation_init_date)) / (1000 * 60 * 60 * 24)) + 1
    }));
    
    return { estado: "OK", data: calendarData };
  } catch (error) {
    console.error("Error en getCalendarData:", error);
    return { estado: "ERROR", mensaje: error.message };
  }
}


