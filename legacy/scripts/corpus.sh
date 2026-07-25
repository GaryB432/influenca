SPECIMEN="/mnt/d/influenca/caps/20260724T000404Z"

CORPUS_DIR="$SPECIMEN/"

# Check if the directory does NOT exist
if [ ! -d $CORPUS_DIR ]; then
  echo "'$CORPUS_DIR' not found. "
else
  rm -rf apps/web/static/corpus

  mkdir -p tmp

  rsync -avP "$CORPUS_DIR" "./tmp/corpus/"

  # rsync -a "$CORPUS_DIR" tmp/corpus/

  rsync -avP "tmp/corpus/" "apps/web/static/corpus"

  echo "Created"
fi


