function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gestión de Personal')
    .addItem('🏠 Abrir App', 'mostrarHTML')
    .addToUi();
}

function doGet(e) {
  // Podés pasar datos a tu HTML
  const template = HtmlService.createTemplateFromFile('index');
  template.titulo = "Mi WebApp con Template"; 
  template.usuario = Session.getActiveUser().getEmail();

  return template.evaluate()
    .setTitle("Gestion Matcheador")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



function mostrarHTML() {
  try {
    const template = HtmlService.createTemplateFromFile('index');
    const htmlOutput = template.evaluate()
      .setWidth(1000)
      .setHeight(700)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    SpreadsheetApp.getUi()
      .showModalDialog(htmlOutput, '🏢 Sistema de Gestión de Personal');
      
  } catch (error) {
    SpreadsheetApp.getUi()
      .alert('Error', 'No se pudo cargar la aplicación: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function mostrarEstadisticas() {
  try {
    const template = HtmlService.createTemplateFromFile('estadisticas');
    const htmlOutput = template.evaluate()
      .setWidth(800)
      .setHeight(600);
    
    SpreadsheetApp.getUi()
      .showModalDialog(htmlOutput, '📊 Estadísticas del Sistema');
      
  } catch (error) {
    // Si no existe el archivo estadisticas.html, mostrar mensaje
    SpreadsheetApp.getUi()
      .alert('Info', 'La página de estadísticas aún no está disponible.', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function mostrarConfiguracion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Configuración del Sistema',
    '¿Qué deseas configurar?\n\n1. Crear hojas faltantes\n2. Verificar estructura\n3. Resetear datos de prueba',
    ui.ButtonSet.YES_NO_CANCEL
  );
  
  if (response === ui.Button.YES) {
    inicializarHojas();
  } else if (response === ui.Button.NO) {
    verificarEstructura();
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error(`Error incluyendo archivo ${filename}:`, error);
    return `<div style="color:red;">Error cargando ${filename}</div>`;
  }
}

// Función para verificar y crear hojas necesarias
function inicializarHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    const hojasNecesarias = [
      {
        nombre: 'users',
        headers: ['user_id', 'user_name', 'user_email', 'user_phone', 'user_address', 'user_birth', 'user_hire_date', 'user_team', 'user_leader', 'user_salary', 'rol']
      },
      {
        nombre: 'passwords', 
        headers: ['user_id', 'user_login_mail', 'user_login_password']
      },
      {
        nombre: 'vacations',
        headers: ['user_id', 'vacation_id', 'user_name', 'user_team', 'user_leader', 'vacation_init_date', 'vacation_end_date']
      },
      {
        nombre: 'absences',
        headers: ['user_id', 'ausencia_id', 'user_name', 'fecha', 'motivo', 'descripcion', 'estado']
      }
    ];
    
    let hojasCreadas = 0;
    let hojasActualizadas = 0;
    
    hojasNecesarias.forEach(hoja => {
      let sheet;
      try {
        sheet = ss.getSheetByName(hoja.nombre);
        // Si la hoja existe pero está vacía, agregar headers
        if (sheet.getLastRow() === 0) {
          sheet.getRange(1, 1, 1, hoja.headers.length).setValues([hoja.headers]);
          sheet.getRange(1, 1, 1, hoja.headers.length).setFontWeight('bold');
          hojasActualizadas++;
        }
      } catch (e) {
        // Si la hoja no existe, crearla
        sheet = ss.insertSheet(hoja.nombre);
        sheet.getRange(1, 1, 1, hoja.headers.length).setValues([hoja.headers]);
        sheet.getRange(1, 1, 1, hoja.headers.length).setFontWeight('bold');
        // Autoajustar columnas
        sheet.autoResizeColumns(1, hoja.headers.length);
        hojasCreadas++;
      }
    });
    
    let mensaje = `Inicialización completada!\n\n`;
    mensaje += `Hojas creadas: ${hojasCreadas}\n`;
    mensaje += `Hojas actualizadas: ${hojasActualizadas}`;
    
    if (hojasCreadas > 0) {
      mensaje += `\n\n⚠️ Recuerda agregar datos de prueba para poder usar el sistema.`;
    }
    
    ui.alert('Éxito', mensaje, ui.ButtonSet.OK);
    
  } catch (error) {
    console.error('Error en inicializarHojas:', error);
    ui.alert('Error', 'Error al inicializar hojas: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function verificarEstructura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    const hojas = ss.getSheets();
    let reporte = 'REPORTE DE ESTRUCTURA:\n\n';
    
    hojas.forEach(hoja => {
      const nombre = hoja.getName();
      const filas = hoja.getLastRow();
      const columnas = hoja.getLastColumn();
      
      reporte += `📄 ${nombre}:\n`;
      reporte += `   - Filas: ${filas}\n`;
      reporte += `   - Columnas: ${columnas}\n`;
      
      if (filas > 0) {
        const headers = hoja.getRange(1, 1, 1, columnas).getValues()[0];
        reporte += `   - Headers: ${headers.join(', ')}\n`;
      }
      reporte += '\n';
    });
    
    ui.alert('Estructura del Sistema', reporte, ui.ButtonSet.OK);
    
  } catch (error) {
    console.error('Error en verificarEstructura:', error);
    ui.alert('Error', 'Error al verificar estructura: ' + error.toString(), ui.ButtonSet.OK);
  }
}

// Función para obtener información del usuario actual
function getCurrentUserInfo() {
  try {
    const email = Session.getActiveUser().getEmail();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName("users");
    const userData = usersSheet.getDataRange().getValues();
    
    const userRow = userData.find(row => row[0] === email);
    
    if (userRow) {
      return {
        email: email,
        name: userRow[1],
        team: userRow[7],
        rol: userRow[10]
      };
    }
    
    return { email: email, name: 'Usuario', team: 'N/A', rol: 'user' };
    
  } catch (error) {
    console.error('Error en getCurrentUserInfo:', error);
    return { email: 'Error', name: 'Error', team: 'Error', rol: 'user' };
  }
}