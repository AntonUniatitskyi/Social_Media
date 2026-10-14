{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    python313
    nodejs_22
    postgresql
    redis
    dos2unix
    git
  ];
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc pkgs.zlib ];

  shellHook = ''
    # если env сломался после обновления nixpkgs (битые симлинки), пересоздаём
    if [ ! -x env/bin/python ]; then
      rm -rf env
      python -m venv env
    fi
    source env/bin/activate

    # зависимости ставим только когда изменился requirements.txt
    if [ -f requirements.txt ] && ! sha256sum requirements.txt | cmp -s - env/.req-hash; then
      pip install -r requirements.txt && sha256sum requirements.txt > env/.req-hash
    fi
  '';
}