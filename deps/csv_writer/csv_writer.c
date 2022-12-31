#include <sqlite3ext.h>
#define SQLITE_VTAB_DIRECTONLY         3
SQLITE_EXTENSION_INIT1
#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdarg.h>
#include <ctype.h>
#include <stdio.h>

const char NEW_LINE[] = "\r\n";

typedef struct Columns {
  const char ** values;
  int size;
} Columns;

typedef struct CsvTable {
  sqlite3_vtab base;
  FILE *out;
  char *filename;
  Columns* columns;
  char separator;
} CsvTable;


static const char *csv_skip_whitespace(const char *z){
  while( isspace((unsigned char)z[0]) ) z++;
  return z;
}

static void csv_trim_whitespace(char *z){
  size_t n = strlen(z);
  while( n>0 && isspace((unsigned char)z[n]) ) n--;
  z[n] = 0;
}

static void csv_dequote(char *z){
  int j;
  char cQuote = z[0];
  size_t i, n;

  if( cQuote!='\'' && cQuote!='"' ) return;
  n = strlen(z);
  if( n<2 || z[n-1]!=z[0] ) return;
  for(i=1, j=0; i<n-1; i++){
    if( z[i]==cQuote && z[i+1]==cQuote ) i++;
    z[j++] = z[i];
  }
  z[j] = 0;
}

static const char *csv_parameter(const char *zTag, int nTag, const char *z){
  z = csv_skip_whitespace(z);
  if( strncmp(zTag, z, nTag)!=0 ) return 0;
  z = csv_skip_whitespace(z+nTag);
  if( z[0]!='=' ) return 0;
  return csv_skip_whitespace(z+1);
}

static int csv_string_parameter(
  const char *zParam,      /* Parameter we are checking for */
  const char *zArg,        /* Raw text of the virtual table argment */
  char **pzVal             /* Write the dequoted string value here */
){
  const char *zValue;
  zValue = csv_parameter(zParam,(int)strlen(zParam),zArg);
  if( zValue==0 ) return 0;
  *pzVal = sqlite3_mprintf("%s", zValue);
  csv_trim_whitespace(*pzVal);
  csv_dequote(*pzVal);
  return 1;
}

static Columns *parse_columns(
  char *value
) {
  Columns *columns = sqlite3_malloc64(sizeof(Columns));

  columns->size = 1;
  for (int i=0;value[i]!=0;i++) {
    if (value[i] == ',') columns->size++;
  }

  columns->values = sqlite3_malloc64(columns->size * sizeof(const char *));

  int index = 0;
  columns->values[index++] = &value[0];
  for (int i=0;value[i]!=0;i++) {
    if (value[i] == ',') {
      value[i] = 0;
      columns->values[index++] = &value[i+1];
    }
  }

  return columns;
}

static const char needCsvQuote[] = {
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 0, 1, 0, 0, 0, 0, 1,   0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1,
};

static void output_csv(FILE *out, const char *z, char separator){
  if(z == 0) {
    return;
  }

  int need_quote = 0;
  for(int i=0; z[i]; i++){
    if(needCsvQuote[((unsigned char*)z)[i]] || z[i] == separator) {
      need_quote = 1;
      break;
    }
  }

  if (need_quote == 1) {
    char *zQuoted = sqlite3_mprintf("\"%w\"", z);
    fprintf(out, "%s", zQuoted);
    sqlite3_free(zQuoted);
  } else {
    fprintf(out, "%s", z);
  }
}

static int csvConnect(
  sqlite3 *db,
  void *pAux,
  int argc,
  const char *const*argv,
  sqlite3_vtab **ppVtab,
  char **pzErr
){
  CsvTable *pNew = 0;        /* The CsvTable object to construct */
  int bHeader = -1;          /* header= flags.  -1 means not seen yet */
  int rc = SQLITE_OK;        /* Result code from this routine */
  int i, j;                  /* Loop counters */
  int b;                     /* Value of a boolean parameter */
  int nCol = -99;            /* Value of the columns= parameter */

  static const char *azParam[] = {"filename", "columns", "separator"};
  char *azPValue[3];         /* Parameter values */
# define CSV_FILENAME    (azPValue[0])
# define CSV_COLUMN      (azPValue[1])
# define CSV_SEPARATOR   (azPValue[2])

  assert( sizeof(azPValue)==sizeof(azParam) );
  memset(azPValue, 0, sizeof(azPValue));

  for(i=3; i<argc; i++){
    const char *z = argv[i];
    const char *zValue;
    for(j=0; j<sizeof(azParam)/sizeof(azParam[0]); j++){
      if(csv_string_parameter(azParam[j], z, &azPValue[j])) break;
    }
  }

  pNew = sqlite3_malloc( sizeof(*pNew) );
  *ppVtab = (sqlite3_vtab*)pNew;
  memset(pNew, 0, sizeof(*pNew));

  pNew->out = fopen(CSV_FILENAME, "wb");
  pNew->columns = parse_columns(CSV_COLUMN);
  pNew->separator = CSV_SEPARATOR[0];

  sqlite3_str *schema_buffer = sqlite3_str_new(0);
  sqlite3_str_appendf(schema_buffer, "CREATE TABLE x(");

  for (int i=0;i<pNew->columns->size;i++) {
    if (i > 0) {
      sqlite3_str_appendf(schema_buffer, ",");
      fprintf(pNew->out, "%c", pNew->separator);
    }
    sqlite3_str_appendf(schema_buffer,"\"%w\" TEXT", pNew->columns->values[i]);
    output_csv(pNew->out, pNew->columns->values[i], pNew->separator);
  }
  fprintf(pNew->out, NEW_LINE);

  sqlite3_str_appendf(schema_buffer, ")");
  const char* schema = sqlite3_str_finish(schema_buffer);

  rc = sqlite3_declare_vtab(db, schema);
  for(i=0; i<sizeof(azPValue)/sizeof(azPValue[0]); i++){
    sqlite3_free(azPValue[i]);
  }
  /* Rationale for DIRECTONLY:
  ** An attacker who controls a database schema could use this vtab
  ** to exfiltrate sensitive data from other files in the filesystem.
  ** And, recommended practice is to put all CSV virtual tables in the
  ** TEMP namespace, so they should still be usable from within TEMP
  ** views, so there shouldn't be a serious loss of functionality by
  ** prohibiting the use of this vtab from persistent triggers and views.
  */
  sqlite3_vtab_config(db, SQLITE_VTAB_DIRECTONLY);
  return SQLITE_OK;
}

static int csvCreate(
  sqlite3 *db,
  void *pAux,
  int argc, const char *const*argv,
  sqlite3_vtab **ppVtab,
  char **pzErr
){
 return csvConnect(db, pAux, argc, argv, ppVtab, pzErr);
}

static int csvDisconnect(sqlite3_vtab *pVtab){
  CsvTable *p = (CsvTable*)pVtab;
  fclose(p->out);
  sqlite3_free(p->filename);
  sqlite3_free(p->columns->values);
  sqlite3_free(p->columns);
  sqlite3_free(p);
  return SQLITE_OK;
}

static int csvUpdate(
  sqlite3_vtab *pVtab,
  int argc,
  sqlite3_value** argv,
  sqlite3_int64* pRowid
){
  CsvTable* p = (CsvTable*)pVtab;

  for (int i=2;i<argc;i++) {
    if (i > 2) {
      fprintf(p->out, "%c", p->separator);
    }
    output_csv(p->out, (const char*) sqlite3_value_text(argv[i]), p->separator);
  }
  fprintf(p->out, NEW_LINE);

  return SQLITE_OK;
}
static sqlite3_module CsvWriterModule = {
  0,                       /* iVersion */
  csvCreate,            /* xCreate */
  csvConnect,           /* xConnect */
  0,                       /* xBestIndex */
  csvDisconnect,        /* xDisconnect */
  csvDisconnect,        /* xDestroy */
  0,                       /* xOpen - open a cursor */
  0,                       /* xClose - close a cursor */
  0,                       /* xFilter - configure scan constraints */
  0,                       /* xNext - advance a cursor */
  0,                       /* xEof - check for end of scan */
  0,                       /* xColumn - read data */
  0,                       /* xRowid - read data */
  csvUpdate,            /* xUpdate */
  0,                       /* xBegin */
  0,                       /* xSync */
  0,                       /* xCommit */
  0,                       /* xRollback */
  0,                       /* xFindMethod */
  0,                       /* xRename */
};

#ifdef _WIN32
__declspec(dllexport)
#endif

int sqlite3_csvwriter_init(
  sqlite3 *db,
  char **pzErrMsg,
  const sqlite3_api_routines *pApi
){
  int rc;
  SQLITE_EXTENSION_INIT2(pApi);
  rc = sqlite3_create_module(db, "csv_writer", &CsvWriterModule, 0);
  return rc;
}
