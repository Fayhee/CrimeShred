import React from "react";

import { WebBundlr } from "@bundlr-network/client"
import BigNumber from "bignumber.js";
import { Button } from "@chakra-ui/button";
import { Input, HStack, Text, VStack, useToast, Menu, MenuButton, MenuList, MenuItem, Tooltip } from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons"



import { Web3Provider } from "@ethersproject/providers";

import * as nearAPI from "near-api-js"
import { WalletConnection } from "near-api-js";

const { keyStores, connect } = nearAPI;



function App() {
  const defaultCurrency = "Select a Currency"
  const defaultSelection = "Select a Provider"
  const [currency, setCurrency] = React.useState<string>(defaultCurrency);
  const [address, setAddress] = React.useState<string>();
  const [selection, setSelection] = React.useState<string>(defaultSelection);
  const [balance, setBalance] = React.useState<string>();
  const [img, setImg] = React.useState<Buffer>();
  const [price, setPrice] = React.useState<BigNumber>();
  const [bundler, setBundler] = React.useState<WebBundlr>();
  const [bundlerHttpAddress, setBundlerAddress] = React.useState<string>(
    "https://node1.bundlr.network"
  );
  const [fundAmount, setFundingAmount] = React.useState<string>();
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>();
  const [provider, setProvider] = React.useState<Web3Provider>();

  const toast = useToast();
  const intervalRef = React.useRef<number>();


  const clean = async () => {
    clearInterval(intervalRef.current)
    setBalance(undefined);
    setImg(undefined);
    setPrice(undefined);
    setBundler(undefined);
    setProvider(undefined);
    setAddress(undefined);
    setCurrency(defaultCurrency);
    setSelection(defaultSelection);

  }


  const handleFileClick = () => {
    var fileInputEl = document.createElement("input");
    fileInputEl.type = "file";
    fileInputEl.accept = "image/*";
    fileInputEl.style.display = "none";
    document.body.appendChild(fileInputEl);
    fileInputEl.addEventListener("input", function (e) {
      handleUpload(e as any);
      document.body.removeChild(fileInputEl);
    });
    fileInputEl.click();
  };

  const handleUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    let files = evt.target.files;
    let reader = new FileReader();
    if (files && files.length > 0) {
      reader.onload = function () {
        if (reader.result) {
          setImg(Buffer.from(reader.result as ArrayBuffer));
        }
      };
      reader.readAsArrayBuffer(files[0]);
    }
  };

  const handlePrice = async () => {
    if (img) {
      const price = await bundler?.utils.getPrice(currency as string, img.length);
      //@ts-ignore
      setPrice(price?.toString());
    }
  };

  const uploadFile = async () => {
    if (img) {
      await bundler?.uploader.upload(img, [{ name: "Content-Type", value: "image/png" }])
        .then((res) => {
          toast({
            status: res?.status === 200 || res?.status === 201 ? "success" : "error",
            title: res?.status === 200 || res?.status === 201 ? "Successful!" : `Unsuccessful! ${res?.status}`,
            description: res?.data.id ? `https://arweave.net/${res.data.id}` : undefined,
            duration: 15000,
          });
        })
        .catch(e => { toast({ status: "error", title: `Failed to upload - ${e}` }) })
    }
  };

  const fund = async () => {
    if (bundler && fundAmount) {
      toast({ status: "info", title: "Funding...", duration: 15000 })
      const value = parseInput(fundAmount)
      if (!value) return
      await bundler.fund(value)
        .then(res => { toast({ status: "success", title: `Funded ${res?.target}`, description: ` tx ID : ${res?.id}`, duration: 10000 }) })
        .catch(e => {
          toast({ status: "error", title: `Failed to fund - ${e.data?.message || e.message}` })
        })
    }

  };

  const withdraw = async () => {
    if (bundler && withdrawAmount) {
      toast({ status: "info", title: "Withdrawing..", duration: 15000 })
      const value = parseInput(withdrawAmount)
      if (!value) return
      await bundler
        .withdrawBalance(value)
        .then((data) => {
          toast({
            status: "success",
            title: `Withdrawal successful - ${data.data?.tx_id}`,
            duration: 5000,
          });
        })
        .catch((err: any) => {
          toast({
            status: "error",
            title: "Withdrawal Unsuccessful!",
            description: err.message,
            duration: 5000,
          });
        });
    }
  };

  // field change event handlers

  const updateAddress = (evt: React.BaseSyntheticEvent) => {
    setBundlerAddress(evt.target.value);
  };

  const updateFundAmount = (evt: React.BaseSyntheticEvent) => {
    setFundingAmount(evt.target.value);
  };

  const updateWithdrawAmount = (evt: React.BaseSyntheticEvent) => {
    setWithdrawAmount(evt.target.value);
  };


  

  /**
   * Map of providers with initialisation code - c is the configuration object from currencyMap
   */
  const providerMap = {
    
    "wallet.near.org": async (c: any) => {
      const near = await connect(c);
      const wallet = new WalletConnection(near, "bundlr");
      if (!wallet.isSignedIn()) {
        toast({ status: "info", title: "You are being redirected to authorize this application..." })
        window.setTimeout(() => { wallet.requestSignIn() }, 4000)
        // wallet.requestSignIn();
      }
      else if (!await c.keyStore.getKey(wallet._networkId, wallet.getAccountId())) {
        toast({ status: "warning", title: "Click 'Connect' to be redirected to authorize access key creation." })
      }
      return wallet
    }

  } as any



  const currencyMap = {
    "near": {
      providers: ["wallet.near.org"],
      opts: {
        networkId: "mainnet",
        keyStore: new keyStores.BrowserLocalStorageKeyStore(),
        nodeUrl: "https://rpc.mainnet.near.org",
        walletUrl: "https://wallet.mainnet.near.org",
        helperUrl: "https://helper.mainnet.near.org",
        explorerUrl: "https://explorer.mainnet.near.org",
      }
    },
    "Near-testnet": {
      providers: ["wallet.near.org"],
      opts: {
        networkId: "testnet",
        keyStore: new keyStores.BrowserLocalStorageKeyStore(),
        nodeUrl: "https://rpc.testnet.near.org",
        walletUrl: "https://wallet.testnet.near.org",
        helperUrl: "https://helper.testnet.near.org",
        explorerUrl: "https://explorer.testnet.near.org",
      }
    }
  } as any


  /**
   * initialises the selected provider/currency
   * @param cname currency name
   * @param pname provider name
   * @returns 
   */
  const initProvider = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    if (provider) {
      setProvider(undefined);
      setBundler(undefined);
      setAddress(undefined);
      return;
    }

    const pname = selection as string;
    const cname = currency as string;
    const p = providerMap[pname] // get provider entry
    const c = currencyMap[cname]
    console.log(`loading: ${pname} for ${cname}`)
    const providerInstance = await p(c.opts).catch((e: Error) => { toast({ status: "error", title: `Failed to load provider ${pname}`, duration: 10000 }); console.log(e); return; })
    setProvider(providerInstance)
  };

  const initBundlr = async () => {
    const bundlr = new WebBundlr(bundlerHttpAddress, currency, provider)
    try {
      // Check for valid bundlr node
      await bundlr.utils.getBundlerAddress(currency)
    } catch {
      toast({ status: "error", title: `Failed to connect to bundlr ${bundlerHttpAddress}`, duration: 10000 })
      return;
    }
    try {
      await bundlr.ready();
    } catch (err) {
      console.log(err);
    } //@ts-ignore
    if (!bundlr.address) {
      console.log("something went wrong");
    }
    toast({ status: "success", title: `Connected to ${bundlerHttpAddress}` })
    setAddress(bundlr?.address)
    setBundler(bundlr);
  }

  const toProperCase = (s: string) => { return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase() }
  const toggleRefresh = async () => {
    if (intervalRef) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = window.setInterval(async () => { bundler?.getLoadedBalance().then((r) => { setBalance(r.toString()) }).catch(_ => clearInterval(intervalRef.current)) }, 5000)
  }

  // parse decimal input into atomic units
  const parseInput = (input: string | number) => {
    const conv = new BigNumber(input).multipliedBy(bundler!.currencyConfig.base[1]);
    if (conv.isLessThan(1)) {
      toast({ status: "error", title: `Value too small!` })
      return;
    }
    return conv;
  }

  return (
    <VStack mt={10} >
      <HStack>
        {" "}
        <Menu >
          <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
            {toProperCase(currency)}
          </MenuButton>
          <MenuList>
            {Object.keys(currencyMap).map((v) => {
              return (<MenuItem key={v} onClick={() => { clean(); setCurrency(v) }}>{toProperCase(v)}</MenuItem>) // proper/title case
            })}
          </MenuList>
        </Menu>
        <Menu >
          <MenuButton disabled={currency === defaultCurrency} as={Button} rightIcon={<ChevronDownIcon />}>
            {selection}
          </MenuButton>
          <MenuList>
            {Object.keys(providerMap).map((v) => {
              return ((currencyMap[currency] && currencyMap[currency].providers.indexOf(v) !== -1) ? (<MenuItem key={v} onClick={() => setSelection(v)}>{v}</MenuItem>) : undefined)
            })}
          </MenuList>
        </Menu>
        <Button disabled={!(selection !== defaultSelection && currency !== defaultCurrency && bundlerHttpAddress.length > 8)} onClick={async () => await initProvider()}>
          {provider ? "Disconnect" : "Connect"}
        </Button>
      </HStack>
      <Text>Connected Account: {address ?? "None"}</Text>
      <HStack>
        <Button w={400} disabled={!provider} onClick={async () => await initBundlr()}>
          Connect to Bundlr
        </Button>
        <Input
          value={bundlerHttpAddress}
          onChange={updateAddress}
          placeholder="Bundler Address"
        />
      </HStack>
      {
        bundler && (
          <>
            <HStack>
              <Button
                onClick={async () => {
                  address &&
                    bundler!
                      .getBalance(address)
                      .then((res: BigNumber) => {
                        setBalance(res.toString())
                      });
                  await toggleRefresh();
                }}

              >
                Get {toProperCase(currency)} Balance
              </Button>
              {balance && (
                <Tooltip label={`(${balance} ${bundler.currencyConfig.base[0]})`}>
                  <Text>
                    {toProperCase(currency)} Balance: {bundler.utils.unitConverter(balance).toFixed(7, 2).toString()} {bundler.currencyConfig.ticker.toLowerCase()}
                  </Text>
                </Tooltip>
              )}
            </HStack>
            <HStack>
              <Button w={200} onClick={fund}>
                Fund Bundlr
              </Button>
              <Input
                placeholder={`${toProperCase(currency)} Amount`}
                value={fundAmount}
                onChange={updateFundAmount}
              />
            </HStack>
            <HStack>
              <Button w={200} onClick={withdraw}>
                Withdraw Balance
              </Button>
              <Input
                placeholder={`${toProperCase(currency)} Amount`}
                value={withdrawAmount}
                onChange={updateWithdrawAmount}
              />
            </HStack>
            <Button onClick={handleFileClick}>Select file from Device</Button>
            {
              img && (
                <>
                  <HStack>
                    <Button onClick={handlePrice}>Get Price</Button>
                    {price && (
                      <Text>{`Cost: ${bundler.utils.unitConverter(price).toString()} ${bundler.currencyConfig.ticker.toLowerCase()} `}</Text>
                    )}
                  </HStack>
                  <Button onClick={uploadFile}>Upload to Bundlr Network</Button>
                </>
              )
            }
          </>
        )
      }
    </VStack >
  );
}

export default App;