function getTareasUsuario(userId) {
  const ss = SpreadsheetApp.openById('1nh8MTyMnJGwQEsxIcPpmxxxgW3pKTbpVadiooL0lI1U');
  const vacSheet = ss.getSheetByName("tasks");
  const data = vacSheet.getDataRange().getValues();
  const headers = data.shift();

  const userIdCol = headers.indexOf("user_id");
  const taskNameCol = headers.indexOf("task_name");
  const taskUrlCol = headers.indexOf("task_link");

  return data.filter(r => r[userIdCol] === userId)
    .map(r => ({
      user_id: r[userIdCol],
      task_name: r[taskNameCol],
      task_link: r[taskUrlCol]
    }));
}